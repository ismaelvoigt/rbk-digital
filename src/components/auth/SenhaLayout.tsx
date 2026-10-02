import Image from 'next/image';
import Link from 'next/link';
import type {ReactNode} from 'react';
export function SenhaLayout({children}:{children:ReactNode}){
 return <main className="min-h-screen flex items-center justify-center bg-[#06142b] px-4 py-8"><section className="w-full max-w-md rounded-[30px] bg-white p-7 shadow-2xl sm:p-8"><Image src="/rbk-digital-logo-original.png" alt="RBK Digital" width={260} height={90} className="mx-auto mb-8 h-16 w-auto object-contain" priority/>{children}<Link href="/" className="mt-6 block text-center text-sm font-medium text-slate-600 hover:text-red-600">Voltar para o login</Link></section></main>;
}
