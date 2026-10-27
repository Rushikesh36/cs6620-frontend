import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewScanWizard } from '@/components/scans/new-scan/new-scan-wizard';
import { readRecentProjects, addRecentProject } from '@/lib/projects/recent-projects';

const { query } = vi.hoisted(() => ({ query: { current: '' } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query.current),
}));
// The review step starts real scans; its own tests cover that, so here it stays idle.
vi.mock('@/hooks/use-submit-scan', () => ({
  useSubmitScan: () => ({
    status: { phase: 'idle' },
    progress: 0,
    notice: null,
    isBusy: false,
    submit: vi.fn(),
    retry: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-targets', () => ({
  useTargets: () => ({
    data: [
      {
        targetId: 'juice-shop',
        name: 'OWASP Juice Shop',
        description: 'Deliberately vulnerable test app',
      },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

beforeEach(() => {
  query.current = '';
  sessionStorage.clear();
});

async function chooseType(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(screen.getByRole('radio', { name: label }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('step 1: scan type', () => {
  it('offers two cards with the wording from the spec', () => {
    render(<NewScanWizard />);
    expect(screen.getByRole('radio', { name: /Code scan \(SAST\)/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Upload your code as a .zip. We read it for risky patterns without running it.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /App scan \(DAST\)/ })).toBeInTheDocument();
    expect(
      screen.getByText('We attack a running test app from the outside to find weaknesses.'),
    ).toBeInTheDocument();
  });

  it('cannot continue until a type is chosen', async () => {
    const user = userEvent.setup();
    render(<NewScanWizard />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Code scan/ }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('works with the keyboard: arrow keys move between the cards', async () => {
    const user = userEvent.setup();
    render(<NewScanWizard />);

    await user.tab();
    expect(screen.getByRole('radio', { name: /Code scan/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: /App scan/ })).toBeChecked();
  });

  it('shows the steps, with the third one named after the chosen type', async () => {
    const user = userEvent.setup();
    render(<NewScanWizard />);
    const progress = screen.getByRole('navigation', { name: 'Progress' });
    expect(progress).toHaveTextContent('Source');
    expect(within(progress).getByText('Scan type').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    await chooseType(user, /App scan/);
    expect(progress).toHaveTextContent('Choose app');
    expect(within(progress).getByText('Project').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
});

describe('step 2: project ID', () => {
  async function toProjectStep(user: ReturnType<typeof userEvent.setup>) {
    render(<NewScanWizard />);
    await chooseType(user, /Code scan/);
    return screen.getByLabelText('Project ID');
  }

  it('shows the rule as helper text', async () => {
    await toProjectStep(userEvent.setup());
    expect(
      screen.getByText(
        '3 to 50 characters. Lowercase letters, digits and hyphens only. Must start with a letter.',
      ),
    ).toBeInTheDocument();
  });

  it('checks the ID as you type, with a plain message for each problem', async () => {
    const user = userEvent.setup();
    const input = await toProjectStep(user);

    await user.type(input, 'ab');
    expect(await screen.findByText('Use at least 3 characters.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await user.type(input, 'C');
    expect(
      await screen.findByText('Use only lowercase letters, digits and hyphens.'),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '9lives');
    expect(await screen.findByText('Start with a lowercase letter.')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'good-name');
    await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid'));
  });

  it('will not continue with an empty or invalid ID', async () => {
    const user = userEvent.setup();
    const input = await toProjectStep(user);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Enter a project ID.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Name the project' })).toBeInTheDocument();

    await user.type(input, 'Bad_ID');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Name the project' })).toBeInTheDocument();
  });

  it('suggests recent projects, filters them as you type, and fills one in when clicked', async () => {
    addRecentProject('demo-app');
    addRecentProject('payments-api');
    const user = userEvent.setup();
    const input = await toProjectStep(user);

    const group = screen.getByRole('group', { name: 'Recent projects' });
    expect(group).toHaveTextContent('payments-api');
    expect(group).toHaveTextContent('demo-app');

    await user.type(input, 'pay');
    expect(screen.getByRole('button', { name: 'payments-api' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'demo-app' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'payments-api' }));
    expect(input).toHaveValue('payments-api');
  });

  it('shows no suggestion box when there are no recent projects', async () => {
    await toProjectStep(userEvent.setup());
    expect(screen.queryByRole('group', { name: 'Recent projects' })).not.toBeInTheDocument();
  });

  it('continues with a valid ID, remembers it, and moves focus to the new step', async () => {
    const user = userEvent.setup();
    const input = await toProjectStep(user);

    await user.type(input, 'my-new-app');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const heading = await screen.findByRole('heading', { name: 'Upload your code' });
    expect(heading).toHaveFocus();
    expect(readRecentProjects()).toEqual(['my-new-app']);
  });

  it('keeps what you typed when you go back and forward', async () => {
    const user = userEvent.setup();
    const input = await toProjectStep(user);
    await user.type(input, 'keep-me');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Project ID')).toHaveValue('keep-me');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /Code scan/ })).toBeChecked();
  });

  it('sends a DAST scan to the app step, and on to review with the chosen app', async () => {
    const user = userEvent.setup();
    render(<NewScanWizard />);
    await chooseType(user, /App scan/);
    await user.type(screen.getByLabelText('Project ID'), 'web-shop');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Choose a test app' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /OWASP Juice Shop/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Review and start' })).toBeInTheDocument();
    expect(screen.getByText(/OWASP Juice Shop \(juice-shop\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start scan' })).toBeEnabled();
  });

  it('keeps the chosen app when you go back and forward', async () => {
    const user = userEvent.setup();
    render(<NewScanWizard />);
    await chooseType(user, /App scan/);
    await user.type(screen.getByLabelText('Project ID'), 'web-shop');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('radio', { name: /OWASP Juice Shop/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByRole('radio', { name: /OWASP Juice Shop/ })).toBeChecked();
  });
});

describe('pre-filling from the link (?type=&project=&target=)', () => {
  it('pre-selects the test app from the link when it is on the allow-list', async () => {
    query.current = 'type=DAST&project=web-shop&target=juice-shop';
    const user = userEvent.setup();
    render(<NewScanWizard />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('radio', { name: /OWASP Juice Shop/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('does not pre-select an app that is not on the allow-list', async () => {
    query.current = 'type=DAST&project=web-shop&target=http%3A%2F%2Fevil.example';
    const user = userEvent.setup();
    render(<NewScanWizard />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('radio', { name: /OWASP Juice Shop/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('starts at the project step with both values filled in', () => {
    query.current = 'type=DAST&project=web-shop';
    render(<NewScanWizard />);
    expect(screen.getByRole('heading', { name: 'Name the project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Project ID')).toHaveValue('web-shop');
  });

  it('ignores a type or project that is not valid', () => {
    query.current = 'type=NOPE&project=Bad%20ID';
    render(<NewScanWizard />);
    expect(screen.getByRole('heading', { name: 'Choose a scan type' })).toBeInTheDocument();

    const second = render(<NewScanWizard />);
    second.unmount();
    query.current = 'type=SAST&project=Bad%20ID';
    render(<NewScanWizard />);
    expect(screen.getAllByLabelText('Project ID').at(-1)).toHaveValue('');
  });
});

describe('step 3 for a code scan: upload', () => {
  const zip = () => {
    const file = new File(['x'], 'my-code.zip', { type: 'application/zip' });
    Object.defineProperty(file, 'size', { value: 4096 });
    return file;
  };

  async function toUploadStep(user: ReturnType<typeof userEvent.setup>) {
    render(<NewScanWizard />);
    await chooseType(user, /Code scan/);
    await user.type(screen.getByLabelText('Project ID'), 'my-app');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Upload your code' });
  }

  it('cannot continue until a valid .zip is chosen', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await toUploadStep(user);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.upload(
      screen.getByLabelText(/Drag and drop your \.zip here/),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/Drag and drop your \.zip here/), zip());
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('keeps the chosen file when you go back and forward', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await toUploadStep(user);
    await user.upload(screen.getByLabelText(/Drag and drop your \.zip here/), zip());

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review and start' })).toHaveFocus();
    expect(screen.getByText(/my-code\.zip \(4 KB\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('my-code.zip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
