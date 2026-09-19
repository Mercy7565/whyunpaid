import { ImageResponse } from 'next/og';

/**
 * The card that appears when someone shares a link.
 *
 * Built from the same five brand colours as the product, and it makes the same
 * argument in one glance: a bill arrives whole, clauses take slices off the
 * right-hand end, and what survives is the warm figure at the bottom.
 *
 * Two constraints Satori imposes, both learned the hard way:
 *
 *  - Its default font has no glyph for the rupee sign, which renders as a
 *    tofu box. The card says "Rs." instead, which is what the specimen policy
 *    wordings themselves say and is correct for the register.
 *  - A text node that wraps inside a flex child can be measured as one line
 *    and drawn as two, which overlaps whatever follows it. Every line here is
 *    its own element, so nothing has to wrap.
 */

export const alt = 'WhyUnpaid? — run your health policy like the program it is';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GROUND = '#0D1F22';
const SLATE = '#38686A';
const SAND = '#CDC6AE';
const BLUE = '#2589BD';
const LINE = '#4A7C7E';

const BANDS = [
  { label: '3.9   Ineligible items', amount: '−Rs. 5,000', left: 98.75, width: 1.25 },
  { label: '4.2   Room rent proportion', amount: '−Rs. 97,333', left: 74.4, width: 24.3 },
  { label: '4.6(b)   Sub-limit', amount: '−Rs. 32,667', left: 66.3, width: 8.2 },
  { label: '4.9   Co-pay', amount: '−Rs. 53,000', left: 53, width: 13.3 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: GROUND,
          padding: '52px 64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Wordmark and the line */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: SAND, letterSpacing: -0.5 }}>
              WhyUnpaid
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: BLUE }}>?</div>
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: SAND, letterSpacing: -0.8, marginTop: 22 }}>
            Your policy is already a program.
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: SAND, letterSpacing: -0.8, marginTop: 4 }}>
            Nobody can read it. So run it.
          </div>
        </div>

        {/* The waterfall */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', fontSize: 15, color: LINE, letterSpacing: 2.4 }}>
              HOSPITAL BILL
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: SAND }}>Rs. 4,00,000</div>
          </div>
          <div style={{ display: 'flex', width: '100%', height: 9, background: SLATE, marginTop: 7 }} />

          {BANDS.map((band) => (
            <div key={band.label} style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', fontSize: 17, color: SAND }}>{band.label}</div>
                <div style={{ display: 'flex', fontSize: 17, color: LINE }}>{band.amount}</div>
              </div>
              <div style={{ display: 'flex', width: '100%', height: 8, marginTop: 5 }}>
                <div style={{ display: 'flex', width: `${band.left}%`, height: 8 }} />
                <div style={{ display: 'flex', width: `${band.width}%`, height: 8, background: SLATE }} />
              </div>
            </div>
          ))}
        </div>

        {/* What survives */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 78, color: SAND, letterSpacing: -2.5, lineHeight: 1 }}>
              Rs. 2,12,000
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: LINE, marginLeft: 18, paddingBottom: 10 }}>
              payable, across four named clauses
            </div>
          </div>
          <div style={{ display: 'flex', width: '53%', height: 12, background: SAND, marginTop: 12 }} />
        </div>
      </div>
    ),
    size,
  );
}
