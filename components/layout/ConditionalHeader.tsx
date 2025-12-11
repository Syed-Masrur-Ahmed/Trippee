'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Hide header on landing page
  if (pathname === '/') {
    return null;
  }
  
  return <Header />;
}

