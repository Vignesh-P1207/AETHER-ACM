const HudCorners = () => (
  <>
    {/* Top-left */}
    <div className="fixed top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary z-50 opacity-60" />
    {/* Top-right */}
    <div className="fixed top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-primary z-50 opacity-60" />
    {/* Bottom-left */}
    <div className="fixed bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-primary z-50 opacity-60" />
    {/* Bottom-right */}
    <div className="fixed bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary z-50 opacity-60" />
  </>
);

export default HudCorners;
