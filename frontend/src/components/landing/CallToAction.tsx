
const CallToAction = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-indigo-600/10 skew-y-3 transform origin-bottom-right -z-10"></div>
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to break the monolith?</h2>
        <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
          Stop debating architecture in endless meetings. Let AI give you the data-driven blueprint you need today.
        </p>
        <button className="px-10 py-5 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl transition-all shadow-xl text-lg">
          Start Your Transformation Free
        </button>
      </div>
    </section>
  );
};

export default CallToAction;
