import { render, screen } from '@testing-library/react';
import Upload from '../../src/components/Upload';
import fs from 'fs';
import path from 'path';

describe('Upload Component', () => {
  it('renders the upload component and can access the test image', () => {
    render(<Upload />);
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeInTheDocument();

    const imagePath = path.join(process.cwd(), 'public/test-images/Gemini_Generated_Image_6zc1b66zc1b66zc1.png');
    const imageExists = fs.existsSync(imagePath);
    expect(imageExists).toBe(true);
  });
});
