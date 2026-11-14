import { render, screen } from '@testing-library/react';
import { CompetitiveSubjectArt } from './competitive-subject-art';

describe('CompetitiveSubjectArt', () => {
  it('pins the subject artwork to its corner and adds the orange hover outline', () => {
    render(<CompetitiveSubjectArt subject="Botany" hover className="hidden sm:block" />);
    const art = screen.getByTestId('subject-art');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(art).toHaveClass('absolute', 'hidden', 'sm:block');
    expect(art).toHaveStyle({ left: '8px', bottom: '0px', width: '318px', height: '86px' });
    const [rest, outline] = Array.from(art.children) as HTMLElement[];
    expect(rest).toHaveClass('bg-brand');
    expect(rest!.style.maskImage).toContain('/illustrations/subjects/neet-botany.svg');
    expect(outline).toHaveClass('bg-accent-400', 'opacity-0', 'group-hover:opacity-100', 'group-focus-visible:opacity-100');
    expect(outline!.style.maskImage).toContain('/illustrations/subjects/neet-botany-hover.svg');
  });

  it('falls back to the default artwork and has no outline without hover', () => {
    render(<CompetitiveSubjectArt subject="Biology" />);
    const art = screen.getByTestId('subject-art');
    expect(art).toHaveAttribute('data-art', '/illustrations/subjects/neet-default.svg');
    expect(art).toHaveStyle({ right: '0px' });
    expect(art.children).toHaveLength(1);
  });
});
