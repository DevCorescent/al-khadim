import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MapPin, Phone, Mail } from 'lucide-react';
import ContactForm from './ContactForm';

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[84px]">
        <section className="bg-gray-900 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-3">CONTACT</p>
            <h1 className="font-heading text-5xl font-bold">Get In Touch</h1>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Info */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Registered Office</h3>
                    <div className="flex gap-3 text-gray-600">
                      <MapPin size={18} className="text-primary-400 mt-0.5 shrink-0" />
                      <p>Sharjah Media City, Sharjah, UAE</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Our Branches</h3>
                    <p className="text-gray-600">Delhi – NCR, Bangalore and Cochin</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-3 text-gray-600">
                      <Phone size={18} className="text-primary-400 mt-0.5 shrink-0" />
                      <div>
                        <p>+971 56 984 2508 (Business)</p>
                        <p>+91 87699 43811 (Al Khadim Inquiry)</p>
                        <p>+91 83958 43828 (General)</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-gray-600">
                      <Mail size={18} className="text-primary-400 mt-0.5 shrink-0" />
                      <div>
                        <p>sales@alkhadim.ae</p>
                        <p>hr@alkhadim.ae</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-5">Send Us a Message</h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
