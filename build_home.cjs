const fs = require('fs');

let content = fs.readFileSync('src/pages/PharmacyLanding.tsx', 'utf8');

// Replace SmartTable with PharmIQ
content = content.replace(/SmartTable/g, 'PharmIQ');
content = content.replace(/smarttable/g, 'pharmiq');

// Remove the if (view === "customer") block. It starts at line 200 and ends around line 257.
// The easiest way is to use a specific string replacement for the customer view.
const startCustomerView = 'if (view === "customer") {';
const endCustomerView = '  }';
const startIndex = content.indexOf(startCustomerView);
if (startIndex !== -1) {
    const startOfReturn = content.indexOf('return (', startIndex);
    const endOfReturn = content.indexOf('</div>\n    );\n  }', startOfReturn);
    if (endOfReturn !== -1) {
        content = content.substring(0, startIndex) + content.substring(endOfReturn + '</div>\n    );\n  }'.length);
    }
}

// Remove the "Are you a restaurant owner?" button logic if any
// Also change the component name and export
content = content.replace(/const PharmacyLanding = \(\) => \{/g, 'const Home = () => {');
content = content.replace(/export default PharmacyLanding;/g, 'export default Home;');

// We need to inject the About content. Let's append the About and Contact sections before the <PublicFooter />
const aboutContent = `
      {/* ── FOUNDER ── */}
      <section className="py-20 md:py-28" id="about">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Photo */}
            <div className="flex justify-center animate-slide-in-left">
              <div className="relative group">
                <div className="absolute -inset-3 rounded-3xl bg-gradient-hero opacity-20 blur-2xl group-hover:opacity-35 transition-opacity duration-500" />
                <div className="absolute -bottom-4 -right-4 z-10 bg-gradient-hero rounded-2xl px-4 py-2.5 shadow-glow animate-pop-in">
                  <div className="text-white font-black text-xs">Founder & CEO</div>
                  <div className="text-white/80 text-[10px]">LightOrb Innovations</div>
                </div>
                <img
                  src="/founder.jpg"
                  alt="Olatunbosun Oluwafemi — Founder of LightOrb Innovations and PharmIQ Nigeria"
                  className="relative rounded-3xl shadow-elevated w-full max-w-sm object-cover aspect-[3/4] group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="animate-slide-in-right">
              <div className="inline-flex items-center gap-2 text-primary text-sm font-bold tracking-wider uppercase mb-4 bg-primary/8 px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                The Founder
              </div>
              <h2 className="text-4xl font-extrabold mb-2 tracking-tight">Olatunbosun Oluwafemi</h2>
              <p className="text-primary font-semibold text-lg mb-6">Founder, LightOrb Innovations</p>

              <p className="text-muted-foreground leading-relaxed mb-5">
                Hi, I'm Olatunbosun — a builder, strategist, and founder obsessed with creating solutions that
                actually move the needle. My passion is helping businesses identify their real challenges, seize
                the right opportunities, and implement intelligent systems that drive lasting, transformative results.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                PharmIQ was born from a simple observation: Nigerian pharmacies are losing revenue and
                trust to manual stock errors and staff theft. I built PharmIQ to fix that — a tailored, affordable,
                and powerful POS system built specifically for the Nigerian market.
              </p>
            </div>
          </div>
        </div>
      </section>
`;

content = content.replace(/<PublicFooter \/>/g, aboutContent + '\n      <PublicFooter />');

fs.writeFileSync('src/pages/Home.tsx', content);
