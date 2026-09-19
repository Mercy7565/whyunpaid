import { ImageResponse } from 'next/og';

/**
 * The card that appears when someone shares a link.
 *
 * Built from the same five brand colours as the product, and it makes the same
 * argument in one glance: a bill arrives whole, clauses take slices off the
 * right-hand end, and what survives is the warm figure at the bottom.
 */

export const alt = 'WhyUnpaid? — run your health policy like the program it is';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GROUND = '#0D1F22';
const SLATE = '#38686A';
const SAND = '#CDC6AE';
const BLUE = '#2589BD';
const LINE = '#4A7C7E';

export default function OpengraphImage() {
  const bands = [
    { label: '3.9  Ineligible items', amount: '−₹5,000', left: 98.75, width: 1.25 },
    { label: '4.2  Room rent proportion', amount: '−₹97,333', left: 74.4, width: 24.3 },
    { label: '4.6(b)  Sub-limit', amount: '−₹32,667', left: 66.3, width: 8.2 },
    { label: '4.9  Co-pay', amount: '−₹53,000', left: 53, width: 13.3 },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: GROUND,
          padding: '56px 64px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: SAND, letterSpacing: -0.5 }}>
            WhyUnpaid
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: BLUE }}>?</div>
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 46,
            lineHeight: 1.12,
            color: SAND,
            letterSpacing: -1,
            maxWidth: 900,
            display: 'flex',
          }}
        >
          Your policy is already a program. Nobody can read it. So run it.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ fontSize: 18, color: LINE, letterSpacing: 2 }}>HOSPITAL BILL</div>
            <div style={{ fontSize: 26, color: SAND }}>&#8377;4,00,000</div>
          </div>
          <div style={{ width: '100%', height: 10, background: SLATE, display: 'flex' }} />

          {bands.map((band) => (
            <div key={band.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ fontSize: 19, color: SAND }}>{band.label}</div>
                <div style={{ fontSize: 19, color: LINE }}>{band.amount}</div>
              </div>
              <div style={{ position: 'relative', width: '100%', height: 9, display: 'flex' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${band.left}%`,
                    width: `${band.width}%`,
                    height: 9,
                    background: SLATE,
                    display: 'flex',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 30, gap: 20 }}>
          <div style={{ fontSize: 92, color: SAND, letterSpacing: -3, lineHeight: 1 }}>
            &#8377;2,12,000
          </div>
          <div style={{ fontSize: 20, color: LINE, paddingBottom: 14 }}>
            payable, across four named clauses
          </div>
        </div>
        <div style={{ width: '53%', height: 14, background: SAND, marginTop: 12, display: 'flex' }} />
      </div>
    ),
    size,
  );
}
