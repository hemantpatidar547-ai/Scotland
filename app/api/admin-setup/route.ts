import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET ()
{
    if ( !supabaseAdmin )
    {
        return NextResponse.json( { error: 'No admin key' } );
    }

    const targetEmail = 'patidarhemant226@gmail.com';
    const targetPassword = 'hemant@226';

    try
    {
        // Get all users
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if ( listError ) throw listError;

        const user = usersData.users.find( u => u.email === targetEmail );

        if ( user )
        {
            // User exists, let's update their password and confirm them so they can login manually
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById( user.id, {
                password: targetPassword,
                email_confirm: true,
            } );

            if ( updateError ) throw updateError;
            return NextResponse.json( {
                success: true,
                message: 'Admin account already existed. Password forcefully updated to hemant@226 and email confirmed.'
            } );
        } else
        {
            // Create user
            const { error: createError } = await supabaseAdmin.auth.admin.createUser( {
                email: targetEmail,
                password: targetPassword,
                email_confirm: true,
            } );

            if ( createError ) throw createError;
            return NextResponse.json( {
                success: true,
                message: 'Admin account freshly created with email patidarhemant226@gmail.com and password hemant@226.'
            } );
        }
    } catch ( error: any )
    {
        return NextResponse.json( { error: error.message } );
    }
}
