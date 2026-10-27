import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UploadZone } from '@/components/scans/upload-zone';

function makeFile(name: string, type: string, size = 2048) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// A tiny host that owns the chosen file, like the wizard does.
function Host({ onChange = vi.fn() }: { onChange?: (file: File | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <UploadZone
      file={file}
      onFileChange={(next) => {
        setFile(next);
        onChange(next);
      }}
    />
  );
}

// applyAccept off: the real browser dialog filters by `accept`, but a drop and our own check must not rely on it.
const setup = () => userEvent.setup({ applyAccept: false });
const input = () => screen.getByLabelText(/Drag and drop your \.zip here/) as HTMLInputElement;

describe('UploadZone: choosing a file', () => {
  it('accepts a .zip, and shows its name and size', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const zip = makeFile('my-code.zip', 'application/zip', 1.5 * 1024 * 1024);

    await setup().upload(input(), zip);

    expect(onChange).toHaveBeenCalledWith(zip);
    expect(screen.getByText('my-code.zip')).toBeInTheDocument();
    expect(screen.getByText('1.5 MB')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a file that is not a .zip, with a clear message', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);

    await setup().upload(input(), makeFile('notes.pdf', 'application/pdf'));

    expect(await screen.findByRole('alert')).toHaveTextContent('"notes.pdf" is not a .zip file.');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText('notes.pdf', { selector: 'p.truncate' })).not.toBeInTheDocument();
  });

  it('refuses a file over 50 MB, and says how big it is', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);

    await setup().upload(input(), makeFile('huge.zip', 'application/zip', 60 * 1024 * 1024));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '"huge.zip" is 60 MB, which is over the 50 MB limit.',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps an accepted file when a later pick is rejected, and clears the error on a good pick', async () => {
    const user = setup();
    render(<Host />);
    await user.upload(input(), makeFile('first.zip', 'application/zip'));

    await user.upload(input(), makeFile('second.txt', 'text/plain'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('first.zip')).toBeInTheDocument();

    await user.upload(input(), makeFile('third.zip', 'application/zip'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('third.zip')).toBeInTheDocument();
  });

  it('lets you remove the file', async () => {
    const onChange = vi.fn();
    const user = setup();
    render(<Host onChange={onChange} />);
    await user.upload(input(), makeFile('my-code.zip', 'application/zip'));

    await user.click(screen.getByRole('button', { name: 'Remove my-code.zip' }));

    expect(screen.queryByText('my-code.zip')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('does not show a file name as markup', async () => {
    render(<Host />);
    await setup().upload(input(), makeFile('<img src=x onerror=alert(1)>.zip', 'application/zip'));
    expect(screen.getByText('<img src=x onerror=alert(1)>.zip')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('UploadZone: drag and drop', () => {
  const dropZone = () => input().closest('label') as HTMLElement;
  const drop = (files: File[]) => fireEvent.drop(dropZone(), { dataTransfer: { files } });

  it('accepts a dropped .zip', () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const zip = makeFile('dropped.zip', 'application/zip');

    drop([zip]);

    expect(onChange).toHaveBeenCalledWith(zip);
    expect(screen.getByText('dropped.zip')).toBeInTheDocument();
  });

  it('refuses a dropped file of the wrong type', () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);

    drop([makeFile('photo.png', 'image/png')]);

    expect(screen.getByRole('alert')).toHaveTextContent('"photo.png" is not a .zip file.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks for one file when several are dropped', () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);

    drop([makeFile('a.zip', 'application/zip'), makeFile('b.zip', 'application/zip')]);

    expect(screen.getByRole('alert')).toHaveTextContent('Choose one .zip file at a time.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('highlights the zone while a file is dragged over it, and stops when it leaves', () => {
    render(<Host />);
    fireEvent.dragEnter(dropZone());
    expect(dropZone()).toHaveAttribute('data-dragging');

    fireEvent.dragLeave(dropZone());
    expect(dropZone()).not.toHaveAttribute('data-dragging');
  });
});

describe('UploadZone: keyboard and screen readers', () => {
  it('is a real file input that Tab reaches, so it works without a mouse', async () => {
    render(<Host />);
    await userEvent.setup().tab();
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute('type', 'file');
  });

  it('tells the browser dialog to prefer .zip files, and states the rule in words', () => {
    render(<Host />);
    expect(input().accept).toContain('.zip');
    expect(input()).toHaveAccessibleDescription('Only .zip files, up to 50 MB.');
  });

  it('can be switched off while an upload is running', () => {
    render(<UploadZone file={null} onFileChange={() => {}} disabled />);
    expect(input()).toBeDisabled();
  });
});
