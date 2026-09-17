'use client';
import { useSearchParams } from 'next/navigation';
import InvoiceBuilder from '../_components/InvoiceBuilder';

export default function NewInvoicePage() {
  const params = useSearchParams();
  const type   = params.get('type') || 'INVOICE';
  return <InvoiceBuilder defaultType={type} />;
}
