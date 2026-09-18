'use client';
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Contact form. Saved as a client enquiry via the public enquiry endpoint, which requires
 * companyName, contactName, email and phone. When no company is given the enquiry is filed
 * under the sender's own name.
 */
export default function ContactForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const get = (k: string) => String(form.get(k) || '').trim();
    const contactName = [get('firstName'), get('lastName')].filter(Boolean).join(' ');
    const company = get('company');
    const payload = {
      contactName,
      companyName: company || `${contactName} (individual)`,
      email: get('email'),
      phone: get('phone'),
      service: 'General enquiry (contact form)',
      message: get('message') || null,
    };
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/enquiries/public`, payload);
      toast.success('Message sent! We will get back to you shortly.');
      formEl.reset();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">First Name *</label>
          <input name="firstName" required className="input" placeholder="John" />
        </div>
        <div>
          <label className="label">Last Name</label>
          <input name="lastName" className="input" placeholder="Doe" />
        </div>
      </div>
      <div>
        <label className="label">Company</label>
        <input name="company" className="input" placeholder="Optional" />
      </div>
      <div>
        <label className="label">Email *</label>
        <input name="email" type="email" required className="input" placeholder="john@example.com" />
      </div>
      <div>
        <label className="label">Phone *</label>
        <input name="phone" type="tel" required className="input" placeholder="+971 50 XXX XXXX" />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea name="message" rows={4} className="input resize-none" placeholder="How can we help you?" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-60">
        {loading ? 'Sending...' : 'Send Message →'}
      </button>
    </form>
  );
}
