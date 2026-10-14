import { NextRequest, NextResponse } from 'next/server';
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
        const name = String( body.name || '' ).trim();
        const isSignup = Boolean( body.isSignup );

        if ( !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email ) )
        {
            return NextResponse.json( { error: 'Please enter a valid email address.' }, { status: 400 } );
        }

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

        if ( !customer && !isSignup )
        {
            // User not found — tell frontend to show signup form
            return NextResponse.json( {
                success: false,
                isNewUser: true,
                error: 'No account found. Please sign up.',
            }, { status: 404 } );
        }

        if ( !customer && isSignup )
        {
            if ( !name || name.length < 2 || name.length > 120 )
            {
                return NextResponse.json( { error: 'Please enter your full name (2-120 characters).' }, { status: 400 } );
            }

            const isAdmin = isAdminEmail( email );

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
        } else if ( customer )
        {
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

        const isAdmin = customer.role === 'admin' || isAdminEmail( email );

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
            message: isSignup ? 'Account created! Welcome to SCOTLAND.' : 'Welcome back!',
            user: {
                id: otpUser.id,
                name: otpUser.name,
                email: otpUser.email,
                role: otpUser.role,
            },
        } );
    } catch ( error )
    {
        console.error( 'Email login error:', error );
        return NextResponse.json(
            { error: 'Login failed. Please try again.' },
            { status: 500 }
        );
    }
}
