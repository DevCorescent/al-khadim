'use client';
import { useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const services = ['Placement Services', 'Recruitment Services', 'Contractual Outsourcing', 'Management Consultancy', 'Permanent Residency', 'Other'];

export default function EnquiryPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());
    try {
      await axios.post(`${API_URL}/api/enquiries/public`, data);
      setSubmitted(true);
      toast.success('Enquiry submitted! We will contact you shortly.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <main className="pt-[84px] min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center py-16 px-4">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enquiry Received!</h2>
            <p className="text-gray-600 mb-6">Our team will get back to you within 24 hours.</p>
            <button onClick={() => setSubmitted(false)} className="btn-primary">Submit Another</button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="pt-[84px] bg-gray-50 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-2">CLIENT ENQUIRY</p>
            <h1 className="font-heading text-4xl font-bold text-gray-900">Hire the Best Talent</h1>
            <p className="text-gray-600 mt-2">Tell us about your hiring needs and we'll connect you with the right candidates</p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <label className="label">Company Name *</label>
              <input name="companyName" required className="input" placeholder="Your Company Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Contact Person *</label>
                <input name="contactName" required className="input" placeholder="Your Name" />
              </div>
              <div>
                <label className="label">Designation</label>
                <input name="designation" className="input" placeholder="HR Manager" />
              </div>
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input name="email" type="email" required className="input" placeholder="hr@company.com" />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input name="phone" required className="input" placeholder="+971 4 XXX XXXX" />
            </div>
            <div>
              <label className="label">Service Required</label>
              <select name="service" className="input">
                <option value="">Select a service</option>
                {services.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Message / Requirements</label>
              <textarea
                name="message"
                rows={4}
                className="input resize-none"
                placeholder="Describe your hiring requirements, number of positions, timeline..."
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 text-base">
              {loading ? 'Submitting...' : 'Send Enquiry →'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
