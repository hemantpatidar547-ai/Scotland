import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, validateEmail } from '@/lib/email-otp';
import { setAuthCookie, type OTPUser } from '@/lib/jwt-auth';
import { isAdminEmail } from '@/lib/admin-authorization';
import clientPromise from '@/lib/mongodb';
import type { ObjectId } from 'mongodb';
import crypto from 'crypto';

export async function POST ( request: NextRequest )
{
    try
    {
        const body = await request.json();
        const email = String( body.email || '' ).trim().toLowerCase();
        const otp = String( body.otp || '' ).trim();
        const name = String( body.name || '' ).trim();
        const isSignup = Boolean( body.isSignup );

        if ( !email || !validateEmail( email ) )
        {
            return NextResponse.json( { error: 'Invalid email address.' }, { status: 400 } );
        }

        if ( !otp || otp.length < 4 || otp.length > 6 )
        {
            return NextResponse.json( { error: 'Enter a valid OTP.' }, { status: 400 } );
        }

        // Verify OTP
        const verification = await verifyOTP( email, otp );
        if ( !verification.success )
        {
            return NextResponse.json( { error: verification.message }, { status: 400 } );
        }

        // OTP verified — now handle user creation / login
        if ( !clientPromise )
        {
            return NextResponse.json( { error: 'Database not available.' }, { status: 500 } );
        }

        const client = await clientPromise;
        const db = client.db( 'scotland' );
        const customersCollection = db.collection<{
            _id: string | ObjectId;
            email: string;
            name: string;
            mobile?: string;
            role: string;
            createdAt?: Date;
            lastLoginAt?: Date;
            loginCount?: number;
            isActive?: boolean;
            addresses?: unknown[];
        }>( 'customers' );

        let customer = await customersCollection.findOne( { email } );

        if ( !customer && isSignup )
        {
            // Validate signup fields
            if ( !name || name.length > 120 )
            {
                return NextResponse.json( { error: 'Enter your name (up to 120 characters).' }, { status: 400 } );
            }

            const isAdmin = isAdminEmail( email );

            // Create new customer
            const newCustomer = {
                _id: crypto.randomUUID(),
                email,
                name,
                mobile: '',
                role: isAdmin ? 'admin' : 'customer',
                createdAt: new Date(),
                lastLoginAt: new Date(),
                loginCount: 1,
                isActive: true,
                addresses: [],
            };

            await customersCollection.insertOne( newCustomer );
            customer = newCustomer;
        } else if ( !customer && !isSignup )
        {
            return NextResponse.json(
                { error: 'No account found with this email. Please sign up first.', requireSignup: true },
                { status: 404 }
            );
        } else if ( customer )
        {
            // Update last login
            await customersCollection.updateOne(
                { email },
                {
                    $set: { lastLoginAt: new Date() },
                    $inc: { loginCount: 1 },
                }
            );
        }

        if ( !customer )
        {
            return NextResponse.json( { error: 'Something went wrong.' }, { status: 500 } );
        }

        // Determine role
        const isAdmin = customer.role === 'admin' || ( customer.email && isAdminEmail( customer.email ) );

        // Create JWT session
        const otpUser: OTPUser = {
            id: customer._id.toString(),
            mobile: ( customer.mobile || '' ) as string,
            name: customer.name as string,
            email,
            role: isAdmin ? 'admin' : 'customer',
        };

        await setAuthCookie( otpUser );

        return NextResponse.json( {
            success: true,
            message: isSignup ? 'Account created successfully!' : 'Login successful!',
            user: {
                id: otpUser.id,
                name: otpUser.name,
                email: otpUser.email,
                role: otpUser.role,
            },
        } );
    } catch ( error )
    {
        console.error( 'Verify OTP error:', error );
        return NextResponse.json(
            { error: 'Could not verify OTP. Please try again.' },
            { status: 500 }
        );
    }
}
