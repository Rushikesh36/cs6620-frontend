import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsOverview } from '@/components/projects/projects-overview';
import { addRecentProject, readRecentProjects } from '@/lib/projects/recent-projects';
import { projectHref, projectScansHref } from '@/lib/utils/project-links';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const seed = (...ids: string[]) => ids.reverse().forEach((id) => addRecentProject(id));
const hrefOf = (link: HTMLElement) => link.getAttribute('href') ?? '';

beforeEach(() => {
  push.mockClear();
  sessionStorage.clear();
});

describe('project links', () => {
  it('build the project and scan history addresses, and encode the ID', () => {
    expect(projectHref('demo-app')).toBe('/projects/detail/?projectId=demo-app');
    expect(projectScansHref('demo-app')).toBe('/scans/?projectId=demo-app');
    expect(projectHref('a&b')).toBe('/projects/detail/?projectId=a%26b');
  });
});

describe('ProjectsOverview: recent projects', () => {
  it('lists the recent projects, newest first, each linking to its page and its scans', () => {
    seed('first-app', 'second-app');
    render(<ProjectsOverview />);

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('first-app');
    expect(
      hrefOf(within(items[0] as HTMLElement).getByRole('link', { name: 'first-app' })),
    ).toMatch(/^\/projects\/detail\/?\?projectId=first-app$/);
    expect(
      hrefOf(
        within(items[1] as HTMLElement).getByRole('link', { name: 'View scans for second-app' }),
      ),
    ).toMatch(/^\/scans\/?\?projectId=second-app$/);
  });

  it('explains an empty list and offers to start a scan', () => {
    render(<ProjectsOverview />);
    expect(screen.getByRole('heading', { name: 'No recent projects yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a scan' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search recent projects')).not.toBeInTheDocument();
  });

  it('searches the list as you type, and says how many are shown', async () => {
    seed('payments-api', 'payments-web', 'demo-app');
    const user = userEvent.setup();
    render(<ProjectsOverview />);

    await user.type(screen.getByLabelText('Search recent projects'), 'PAY');

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('demo-app')).not.toBeInTheDocument();
    expect(screen.getByText('2 projects shown')).toBeInTheDocument();
  });

  it('says so when nothing matches, and clears the search in one click', async () => {
    seed('demo-app');
    const user = userEvent.setup();
    render(<ProjectsOverview />);

    await user.type(screen.getByLabelText('Search recent projects'), 'zzz');
    expect(
      screen.getByRole('heading', { name: 'No recent project matches your search' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 projects shown')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('demo-app')).toBeInTheDocument();
    expect(screen.getByLabelText('Search recent projects')).toHaveValue('');
  });
});

describe('ProjectsOverview: open any project', () => {
  it('opens the project with the typed ID, and remembers it', async () => {
    const user = userEvent.setup();
    render(<ProjectsOverview />);

    await user.type(screen.getByLabelText('Project ID'), 'web-shop{Enter}');

    expect(push).toHaveBeenCalledWith('/projects/detail/?projectId=web-shop');
    expect(readRecentProjects()).toEqual(['web-shop']);
  });

  it('refuses an invalid ID, with the rule explained', async () => {
    const user = userEvent.setup();
    render(<ProjectsOverview />);

    await user.type(screen.getByLabelText('Project ID'), 'Bad ID');
    await user.click(screen.getByRole('button', { name: 'Open project' }));

    expect(
      await screen.findByText('Use only lowercase letters, digits and hyphens.'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(readRecentProjects()).toEqual([]);
  });
});
