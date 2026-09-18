// Ported from api/src/ai/quickActions.js
/**
 * Curated follow-up question suggestions ("quick actions"), keyed by which
 * tool(s) a turn actually called. Deliberately NOT model-generated — a fixed,
 * hand-picked list per tool means suggestions are always sensible and never
 * hallucinated, at the cost of not being personalized to the exact answer.
 */
const SUGGESTIONS: Record<string, string[]> = {
  // Recruitment
  searchCandidates: ['Show me the candidate pipeline by status', 'Which candidates have interviews scheduled?'],
  getCandidatePipelineSummary: ['Show me all new candidates', 'What is the interview outcome rate?'],
  searchJobs: ['Which jobs have the lowest fill rate?', 'Show me upcoming interviews'],
  getJobFillRateReport: ['List jobs that are still open', 'Show me recent interview outcomes'],
  getUpcomingInterviews: ['Summarize interview outcomes', 'Show me the candidate pipeline'],
  getInterviewOutcomesReport: ['Show me upcoming interviews', 'Show me the job fill rate report'],

  // HR
  searchEmployees: ['Show me employees with expiring documents', "What's the attendance summary this month?"],
  getAttendanceSummary: ['Show me pending leave requests', 'List employees with expiring documents'],
  getLeaveBalanceReport: ['Summarize attendance this month', 'Show me employees with expiring documents'],
  getExpiringDocumentsReport: ['Show me the attendance summary', 'List all active employees'],

  // Finance
  searchInvoices: ['Summarize revenue by month', 'Show me the expense breakdown by category'],
  getRevenueSummary: ['Break down expenses by category', 'Show me the budget vs actual report'],
  searchExpenses: ['Break down expenses by category', "Show me this month's budget vs actual"],
  getExpenseBreakdownByCategory: ['Show me the budget vs actual report', 'Summarize revenue this year'],
  searchPayrollRecords: ["Summarize this month's payroll", 'Show me bank account balances'],
  getPayrollSummary: ['Show me bank account balances', 'Break down expenses by category'],
  getBankAccountBalances: ['Summarize revenue this year', "Show me this month's expenses"],
  getBudgetVsActualReport: ['Break down expenses by category', "Summarize this month's payroll"],

  // CRM
  searchClients: ['Show me the sales pipeline', 'List recent activity for our clients'],
  searchDeals: ['Show me the sales pipeline by stage', "What's our deal win/loss rate?"],
  getSalesPipelineReport: ["What's our win/loss rate?", 'Show me deals in negotiation'],
  getDealWinLossReport: ['Show me the sales pipeline', 'List recent CRM activity'],
  getRecentActivities: ['Show me the sales pipeline', 'List open deals by stage'],

  // Cross-module
  getCompanyKPISummary: ['Give me a financial KPI summary', 'Show me the candidate pipeline'],
  getFinancialKPISummary: ['Break down expenses by category', 'Show me bank account balances'],
};

const FALLBACK = [
  'Give me a company KPI summary',
  'Show me the candidate pipeline',
  'Summarize this month’s finances',
];

/**
 * @param toolNames - tools actually called during this turn, in call order
 * @returns up to `limit` unique, curated follow-up questions
 */
export function getQuickActionsForTools(toolNames: string[], limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of toolNames || []) {
    for (const suggestion of SUGGESTIONS[name] || []) {
      if (!seen.has(suggestion)) {
        seen.add(suggestion);
        out.push(suggestion);
        if (out.length >= limit) return out;
      }
    }
  }
  if (out.length === 0) {
    return FALLBACK.slice(0, limit);
  }
  return out;
}
