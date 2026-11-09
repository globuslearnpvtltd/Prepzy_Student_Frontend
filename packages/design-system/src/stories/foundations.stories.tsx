import type { Meta, StoryObj } from '@storybook/react-vite';
import designConfig from '../../design.config.ts';

/** Token reference rendered straight from design.config.ts, so it is always current. */
const meta = { title: 'Foundations/Tokens' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const { tokens, semantic } = designConfig;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export const Colors: Story = {
  render: () => (
    <>
      <Section title="Semantic colours (use these in pages and components)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(semantic).map(([name, value]) => (
            <div key={name} className="border-border bg-surface rounded-md border p-2">
              <div className="border-border h-12 rounded-sm border" style={{ background: `var(--color-${name})` }} />
              <p className="mt-1 text-sm font-semibold">{name}</p>
              <p className="text-foreground-muted text-xs">{value}</p>
            </div>
          ))}
        </div>
      </Section>
      {Object.entries(tokens.colors).map(([scale, steps]) => (
        <Section key={scale} title={`Palette: ${scale}`}>
          <div className="flex flex-wrap gap-3">
            {Object.entries(steps).map(([step, hex]) => (
              <div key={step} className="w-28">
                <div className="border-border h-12 rounded-sm border" style={{ background: hex }} />
                <p className="mt-1 text-xs">
                  {scale}.{step} · {hex}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  ),
};

export const Typography: Story = {
  render: () => (
    <Section title="Font sizes">
      {Object.entries(tokens.fontSizes).map(([name, [size, lineHeight]]) => (
        <p key={name} style={{ fontSize: `var(--text-${name})`, lineHeight: `var(--text-${name}--line-height)` }}>
          {name} · {size}/{lineHeight} — Learn smarter with Prepzy
        </p>
      ))}
    </Section>
  ),
};

export const RadiusSpacingShadows: Story = {
  render: () => (
    <>
      <Section title="Radius">
        <div className="flex flex-wrap gap-4">
          {Object.entries(tokens.radius).map(([name, value]) => (
            <div key={name} className="text-center text-xs">
              <div className="bg-brand-soft border-border-strong size-16 border" style={{ borderRadius: value }} />
              {name} · {value}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Spacing">
        {Object.entries(tokens.spacing).map(([name, value]) => (
          <div key={name} className="mb-1 flex items-center gap-3 text-xs">
            <span className="w-20">
              {name} · {value}
            </span>
            <span className="bg-brand h-3 rounded-sm" style={{ width: value }} />
          </div>
        ))}
      </Section>
      <Section title="Shadows">
        <div className="flex flex-wrap gap-6">
          {Object.entries(tokens.shadows).map(([name, value]) => (
            <div
              key={name}
              className="bg-surface flex size-28 items-center justify-center rounded-lg text-xs"
              style={{ boxShadow: value }}
            >
              {name}
            </div>
          ))}
        </div>
      </Section>
    </>
  ),
};
