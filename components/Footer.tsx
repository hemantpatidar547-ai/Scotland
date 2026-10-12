import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-navy text-[#e9e4db]">
      <div className="shell grid gap-12 py-16 sm:grid-cols-1 md:grid-cols-3">
        
        {/* Brand Details */}
        <div className="md:pr-8">
          <div className="font-display text-3xl tracking-[0.15em] text-white uppercase">
            Scotland
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            A premium clothing brand rooted in Scotland. Designed for the modern wardrobe with 
            character, elegance, and timeless style.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="eyebrow text-white mb-6">Explore</h3>
          <ul className="space-y-4 text-sm text-slate-300 font-medium tracking-wide">
            <li>
              <Link href="/" className="hover:text-white transition">Home</Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-white transition">Shop / Products</Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-white transition">About Us</Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white transition">Contact Support</Link>
            </li>
          </ul>
        </div>

        {/* Social Links */}
        <div>
          <h3 className="eyebrow text-white mb-6">Connect with us</h3>
          <p className="text-sm text-slate-400 mb-6">Stay updated on our latest collections, exclusive offers, and brand news.</p>
          <div className="flex items-center gap-5">
            {/* Instagram */}
            <a href="#" className="bg-white/5 p-3 rounded hover:bg-white/10 hover:text-white transition text-slate-300 border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
            
            {/* WhatsApp */}
            <a href="#" className="bg-white/5 p-3 rounded hover:bg-white/10 hover:text-white transition text-slate-300 border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </a>

            {/* Twitter */}
            <a href="#" className="bg-white/5 p-3 rounded hover:bg-white/10 hover:text-white transition text-slate-300 border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
              </svg>
            </a>
          </div>
        </div>

      </div>

      {/* Copyright */}
      <div className="border-t border-slate-700/50">
        <div className="shell py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-mono text-[10px] tracking-widest text-slate-400">
            © {new Date().getFullYear()} SCOTLAND · ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-4 font-mono text-[10px] tracking-widest text-slate-400">
            <span className="cursor-pointer hover:text-white transition">PRIVACY</span>
            <span className="cursor-pointer hover:text-white transition">TERMS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
