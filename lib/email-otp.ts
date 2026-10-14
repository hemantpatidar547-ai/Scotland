/**
 * Email OTP Service
 * Generates, stores, and verifies OTP codes sent via email.
 * Uses Nodemailer with Ethereal (free) for development.
 * Replace transporter config with real SMTP (Gmail, SendGrid, etc.) for production.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import clientPromise from '@/lib/mongodb';

let transporterPromise: Promise<Transporter> | null = null;

async function getTransporter (): Promise<Transporter>
{
    if ( !transporterPromise )
    {
        transporterPromise = ( async () =>
        {
            // Check if real SMTP credentials are provided
            if ( process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS )
            {
                return nodemailer.createTransport( {
                    host: process.env.SMTP_HOST,
                    port: Number( process.env.SMTP_PORT || 587 ),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                } );
            }

            // Fallback: Use free Ethereal test account
            const testAccount = await nodemailer.createTestAccount();
            console.log( '📧 Using Ethereal test email account:', testAccount.user );
            return nodemailer.createTransport( {
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            } );
        } )();
    }
    return transporterPromise;
}

function generateOTP (): string
{
    return String( Math.floor( 1000 + Math.random() * 9000 ) ); // 4-digit OTP
}

export function validateEmail ( email: string ): boolean
{
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email );
}

export async function sendOTP ( email: string ): Promise<{ success: boolean; message: string }>
{
    try
    {
        const otp = generateOTP();
        const expiresAt = new Date( Date.now() + 10 * 60 * 1000 ); // 10 minutes

        // Store OTP in MongoDB
        if ( clientPromise )
        {
            const client = await clientPromise;
            const db = client.db( 'scotland' );
            await db.collection( 'otp_codes' ).updateOne(
                { email: email.toLowerCase() },
                {
                    $set: {
                        otp,
                        expiresAt,
                        attempts: 0,
                        updatedAt: new Date(),
                    },
                },
                { upsert: true }
            );
        }

        // Send email
        const transporter = await getTransporter();
        const info = await transporter.sendMail( {
            from: process.env.SMTP_FROM || '"SCOTLAND" <no-reply@scotland.com>',
            to: email,
            subject: 'Your SCOTLAND Login OTP',
            text: `Your OTP code is ${ otp }. It will expire in 10 minutes.`,
            html: `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 30px; background: #ffffff; border-radius: 12px;">
                    <h2 style="color: #0F1B2D; font-size: 24px; margin-bottom: 8px;">SCOTLAND</h2>
                    <p style="color: #555; font-size: 14px; margin-bottom: 24px;">Your one-time password for login:</p>
                    <div style="background: #f8f9fa; border: 2px solid #D9D6CE; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #0F1B2D;">${ otp }</span>
                    </div>
                    <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
                </div>
            `,
        } );

        // Log Ethereal preview URL for development
        const previewUrl = nodemailer.getTestMessageUrl( info );
        if ( previewUrl )
        {
            console.log( '📧 Email Preview URL:', previewUrl );
        }

        return { success: true, message: 'OTP sent to your email.' };
    } catch ( error )
    {
        console.error( 'Email OTP send error:', error );
        return { success: false, message: 'Failed to send OTP email. Please try again.' };
    }
}

export async function verifyOTP ( email: string, otp: string ): Promise<{ success: boolean; message: string }>
{
    try
    {
        if ( !clientPromise )
        {
            return { success: false, message: 'Database not available.' };
        }

        const client = await clientPromise;
        const db = client.db( 'scotland' );
        const record = await db.collection( 'otp_codes' ).findOne( {
            email: email.toLowerCase(),
        } );

        if ( !record )
        {
            return { success: false, message: 'No OTP found. Please request a new one.' };
        }

        // Check expiry
        if ( record.expiresAt < new Date() )
        {
            await db.collection( 'otp_codes' ).deleteOne( { email: email.toLowerCase() } );
            return { success: false, message: 'OTP has expired. Please request a new one.' };
        }

        // Check max attempts
        if ( record.attempts >= 5 )
        {
            await db.collection( 'otp_codes' ).deleteOne( { email: email.toLowerCase() } );
            return { success: false, message: 'Too many attempts. Please request a new OTP.' };
        }

        // Verify OTP
        if ( record.otp !== otp )
        {
            await db.collection( 'otp_codes' ).updateOne(
                { email: email.toLowerCase() },
                { $inc: { attempts: 1 } }
            );
            return { success: false, message: 'Invalid OTP. Please try again.' };
        }

        // OTP matched — delete it
        await db.collection( 'otp_codes' ).deleteOne( { email: email.toLowerCase() } );
        return { success: true, message: 'OTP verified successfully.' };
    } catch ( error )
    {
        console.error( 'Email OTP verify error:', error );
        return { success: false, message: 'Could not verify OTP. Please try again.' };
    }
}

export async function resendOTP ( email: string ): Promise<{ success: boolean; message: string }>
{
    return sendOTP( email );
}
