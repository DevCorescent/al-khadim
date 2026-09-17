import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomeHero from '@/components/home/HomeHero';
import HomeClients from '@/components/home/HomeClients';
import HomeStats from '@/components/home/HomeStats';
import HomeServices from '@/components/home/HomeServices';
import HomeProcess from '@/components/home/HomeProcess';
import HomeWhyUs from '@/components/home/HomeWhyUs';
import HomeIndustries from '@/components/home/HomeIndustries';
import HomeJobs from '@/components/home/HomeJobs';
import HomeCandidates from '@/components/home/HomeCandidates';
import HomeGlobalBanner from '@/components/home/HomeGlobalBanner';
import HomeTestimonials from '@/components/home/HomeTestimonials';
import HomeAwards from '@/components/home/HomeAwards';
import HomeCEO from '@/components/home/HomeCEO';
import HomeCVUpload from '@/components/home/HomeCVUpload';
import HomeCTA from '@/components/home/HomeCTA';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HomeHero />
        <HomeClients />
        <HomeStats />
        <HomeServices />
        <HomeProcess />
        <HomeWhyUs />
        <HomeIndustries />
        <HomeJobs />
        <HomeCandidates />
        <HomeGlobalBanner />
        <HomeTestimonials />
        <HomeAwards />
        <HomeCEO />
        <HomeCVUpload />
        <HomeCTA />
      </main>
      <Footer />
    </>
  );
}
