import LandingPage from './pages/LandingPage';

function App() {
  return (
    <>
      {/* 
        We render the LandingPage here.
        Later, we can wrap this in React Router to switch between
        the landing page and the actual application dashboard.
      */}
      <LandingPage />
    </>
  );
}

export default App;
