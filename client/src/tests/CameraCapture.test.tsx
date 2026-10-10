import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { CameraCapture } from '../components/employee/CameraCapture';

describe('CameraCapture Component', () => {
  let mockStop: ReturnType<typeof vi.fn>;
  let mockTrack: MediaStreamTrack;
  let mockStream: MediaStream;

  beforeEach(() => {
    mockStop = vi.fn();
    mockTrack = {
      stop: mockStop,
      kind: 'video',
      id: 'mock-track-1',
      enabled: true,
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    Object.defineProperty(window, 'isSecureContext', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('stops all media tracks on unmount', async () => {
    const handleCapture = vi.fn();

    const { unmount } = render(
      <CameraCapture onCapture={handleCapture} />
    );

    // Wait for stream to be attached
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    // Unmount the component
    unmount();

    // Verify all media tracks were stopped
    expect(mockStop).toHaveBeenCalled();
  });

  it('displays permission error when getUserMedia rejects with NotAllowedError', async () => {
    const notAllowedError = new Error('Permission denied');
    notAllowedError.name = 'NotAllowedError';

    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(notAllowedError);

    const handleCapture = vi.fn();

    render(<CameraCapture onCapture={handleCapture} />);

    expect(
      await screen.findByText(/Camera permission was denied/i)
    ).toBeInTheDocument();
  });

  it('displays hardware error when no camera device is found', async () => {
    const notFoundError = new Error('Requested device not found');
    notFoundError.name = 'NotFoundError';

    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(notFoundError);

    const handleCapture = vi.fn();

    render(<CameraCapture onCapture={handleCapture} />);

    expect(
      await screen.findByText(/No camera hardware detected/i)
    ).toBeInTheDocument();
  });
});
