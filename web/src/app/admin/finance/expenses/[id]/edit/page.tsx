'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import ExpenseForm from '../../_components/ExpenseForm';

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <ExpenseForm existing={expense} />;
}
