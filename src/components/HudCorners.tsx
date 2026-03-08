const HudCorners = () => (
  <>
    {/* Top-left */}
    <div className="fixed top-3 left-3 w-10 h-10 z-50 opacity-50">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-transparent" />
      <div className="absolute top-0 left-0 h-full w-0.5 bg-gradient-to-b from-primary to-transparent" />
    </div>
    {/* Top-right */}
    <div className="fixed top-3 right-3 w-10 h-10 z-50 opacity-50">
      <div className="absolute top-0 right-0 w-full h-0.5 bg-gradient-to-l from-primary to-transparent" />
      <div className="absolute top-0 right-0 h-full w-0.5 bg-gradient-to-b from-primary to-transparent" />
    </div>
    {/* Bottom-left */}
    <div className="fixed bottom-3 left-3 w-10 h-10 z-50 opacity-50">
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-transparent" />
      <div className="absolute bottom-0 left-0 h-full w-0.5 bg-gradient-to-t from-primary to-transparent" />
    </div>
    {/* Bottom-right */}
    <div className="fixed bottom-3 right-3 w-10 h-10 z-50 opacity-50">
      <div className="absolute bottom-0 right-0 w-full h-0.5 bg-gradient-to-l from-primary to-transparent" />
      <div className="absolute bottom-0 right-0 h-full w-0.5 bg-gradient-to-t from-primary to-transparent" />
    </div>
  </>
);

export default HudCorners;
