import { render, screen } from '@testing-library/react';
import DownloadButtons from '../../src/components/DownloadButtons';

describe('DownloadButtons Component', () => {
  it('renders the download buttons', () => {
    render(<DownloadButtons />);
    const downloadButton = screen.getByRole('button', { name: /download/i });
    expect(downloadButton).toBeInTheDocument();
  });
});
