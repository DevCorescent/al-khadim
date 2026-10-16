'use client';
import PageEditor from '@/components/admin/page-builder/Editor';

export default function EditPage({ params }: { params: { id: string } }) {
  return <PageEditor id={params.id} />;
}
