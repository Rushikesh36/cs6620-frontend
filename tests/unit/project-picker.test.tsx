import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPicker } from '@/components/projects/project-picker';

function setup(props: Partial<Parameters<typeof ProjectPicker>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <ProjectPicker recentProjects={[]} submitLabel="Show scans" onSubmit={onSubmit} {...props} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('ProjectPicker', () => {
  it('opens the typed project', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText('Project ID'), 'demo-app{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('demo-app');
  });

  it('starts with the value it is given', () => {
    setup({ initialValue: 'web-shop' });
    expect(screen.getByLabelText('Project ID')).toHaveValue('web-shop');
  });

  it('states the rule, and checks it as you type without opening anything', async () => {
    const { onSubmit, user } = setup();
    expect(screen.getByText(/3 to 50 characters/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Project ID'), 'Bad');
    expect(
      await screen.findByText('Use only lowercase letters, digits and hyphens.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show scans' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for a project ID when the field is empty', async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Show scans' }));
    expect(await screen.findByText('Enter a project ID.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens a recent project with one click', async () => {
    const { onSubmit, user } = setup({ recentProjects: ['demo-app', 'payments-api'] });
    const group = screen.getByRole('group', { name: 'Recent projects' });
    expect(group).toHaveTextContent('demo-app');

    await user.click(screen.getByRole('button', { name: 'payments-api' }));

    expect(onSubmit).toHaveBeenCalledWith('payments-api');
  });

  it('hides the recent list when there is none, and shows at most six', () => {
    const { unmount } = render(
      <ProjectPicker recentProjects={[]} submitLabel="Go" onSubmit={() => {}} />,
    );
    expect(screen.queryByRole('group', { name: 'Recent projects' })).not.toBeInTheDocument();
    unmount();

    const many = Array.from({ length: 9 }, (_, i) => `project-${String.fromCharCode(97 + i)}`);
    render(<ProjectPicker recentProjects={many} submitLabel="Go" onSubmit={() => {}} />);
    expect(screen.getAllByRole('button', { name: /^project-/ })).toHaveLength(6);
  });
});
