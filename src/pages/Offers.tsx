import { useState, useEffect } from 'react';
import { Tag, Calendar, ArrowLeft, Loader2, Sparkles, CheckCircle2, Clock4 } from 'lucide-react';
import { sanitizeHtml } from '../utils/htmlSanitize';
import { useSeoMeta } from '../seo/useSeoMeta';

interface Offer {
  id: string;
  offer_name: string;
  slug: string;
  start_date: string;
  end_date: string;
  offer_details: string;
  created_at: string;
}

export default function Offers() {
  useSeoMeta({
    title: 'Offers - PayByCard',
    description: 'Explore the latest promotional offers and cashback deals on PayByCard.',
  });

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-active-offers`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load offers');
      setOffers(data.offers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getOfferStatus = (offer: Offer): { label: string; className: string; icon: typeof CheckCircle2 } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(offer.end_date);
    if (today > end) {
      return { label: 'Ended', className: 'bg-white/90 text-gray-600 border-gray-200', icon: Clock4 };
    }
    return { label: 'Active', className: 'bg-white/90 text-green-700 border-green-200', icon: CheckCircle2 };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 className="w-10 h-10 text-[#8c76f0] animate-spin" />
      </div>
    );
  }

  if (selectedOffer) {
    return (
      <div className="min-h-screen pt-20 bg-gradient-to-b from-purple-50/30 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={() => setSelectedOffer(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-[#8c76f0] transition-colors mb-8 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to all offers</span>
          </button>

          <article className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#8c76f0] to-purple-600 px-8 py-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDate(selectedOffer.start_date)} — {formatDate(selectedOffer.end_date)}
                  </span>
                </div>
                {(() => {
                  const status = getOfferStatus(selectedOffer);
                  const StatusIcon = status.icon;
                  return (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${status.className}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  );
                })()}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{selectedOffer.offer_name}</h1>
            </div>

            <div className="px-6 sm:px-8 py-8">
              <div
                className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-[#8c76f0] prose-img:rounded-xl prose-img:mx-auto"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(selectedOffer.offer_details || ''),
                }}
              />
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-gradient-to-b from-purple-50/30 via-white to-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-violet-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#8c76f0] rounded-full filter blur-3xl opacity-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400 rounded-full filter blur-3xl opacity-10" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-[#8c76f0] rounded-full text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            Latest Promotions
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Exclusive Offers
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover the latest deals, cashback offers, and promotions available on PayByCard
          </p>
        </div>
      </section>

      {/* Offers Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {error ? (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-50 rounded-full mb-6">
              <Tag className="w-10 h-10 text-[#8c76f0]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No active offers right now</h2>
            <p className="text-gray-500">
              Check back soon for exciting new promotions and deals
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer, index) => (
              <article
                key={offer.id}
                onClick={() => setSelectedOffer(offer)}
                className="group bg-white rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative bg-gradient-to-br from-[#8c76f0] to-purple-600 px-6 py-5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
                  {(() => {
                    const status = getOfferStatus(offer);
                    const StatusIcon = status.icon;
                    return (
                      <div className="absolute top-3 right-3 z-10">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${status.className}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="relative flex items-start justify-between">
                    <div className="flex-1 pr-20">
                      <h3 className="text-lg font-bold text-white leading-snug">
                        {offer.offer_name}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <Calendar className="w-4 h-4 text-[#8c76f0]" />
                    <span>
                      {formatDate(offer.start_date)} — {formatDate(offer.end_date)}
                    </span>
                  </div>

                  <div
                    className="text-sm text-gray-600 line-clamp-3 overflow-hidden"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(offer.offer_details || ''),
                    }}
                  />

                  <div className="mt-4 flex items-center text-sm font-medium text-[#8c76f0] group-hover:gap-2 transition-all">
                    <span>Read more</span>
                    <ArrowLeft className="w-4 h-4 rotate-180 ml-1 group-hover:ml-2 transition-all" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
