declare module '@cashfreepayments/cashfree-js'
{
    export type CashfreeCheckoutMode = 'sandbox' | 'production';

    export type CashfreeCheckoutResponse = {
        error?: {
            message?: string;
            code?: string;
        };
        paymentDetails?: {
            paymentMessage?: string;
        };
    };

    export type CashfreeCheckout = {
        checkout ( options: {
            paymentSessionId: string;
            redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
        } ): Promise<CashfreeCheckoutResponse | null>;
    };

    export function load ( options: { mode: CashfreeCheckoutMode } ): Promise<CashfreeCheckout | null>;
}
