'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import InvoiceBuilder from '../_components/InvoiceBuilder';

function NewInvoiceContent() {
  const params   = useSearchParams();
  const type     = params.get('type') || 'INVOICE';
  // `?clientId=<id>` (e.g. "+ Invoice" on the client detail page) preselects the client.
  const clientId = params.get('clientId') || '';
  return <InvoiceBuilder defaultType={type} defaultClientId={clientId} />;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={null}>
      <NewInvoiceContent />
    </Suspense>
  );
}
