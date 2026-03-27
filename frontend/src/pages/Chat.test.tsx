import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ChatDashboard from './Chat';
import { useAuthStore } from '../store/useAuthStore';

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onmessage: ((event: MessageEvent) => void) | null = null;

  send = vi.fn();
  close = vi.fn();
}

const makeJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('Chat unread badge', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.spyOn(window, 'setInterval').mockImplementation(
      () => 0 as unknown as ReturnType<typeof setInterval>
    );
    vi.spyOn(window, 'clearInterval').mockImplementation(() => {});

    useAuthStore.setState({
      token: 'test-token',
      user: {
        id: 1,
        email: 'me@test.local',
        full_name: 'Me',
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/v1/chats/') && !url.includes('/messages')) {
          return makeJsonResponse([
            {
              id: 1,
              type: 'group',
              name: 'Alpha',
              created_at: new Date().toISOString(),
              unread_count: 0,
              participants: [
                {
                  user_id: 1,
                  role: 'admin',
                  joined_at: new Date().toISOString(),
                  user: { id: 1, email: 'me@test.local', full_name: 'Me' },
                },
                {
                  user_id: 2,
                  role: 'member',
                  joined_at: new Date().toISOString(),
                  user: { id: 2, email: 'other@test.local', full_name: 'Other' },
                },
              ],
            },
            {
              id: 2,
              type: 'private',
              name: null,
              created_at: new Date().toISOString(),
              unread_count: 3,
              participants: [
                {
                  user_id: 1,
                  role: 'member',
                  joined_at: new Date().toISOString(),
                  user: { id: 1, email: 'me@test.local', full_name: 'Me' },
                },
                {
                  user_id: 3,
                  role: 'member',
                  joined_at: new Date().toISOString(),
                  user: { id: 3, email: 'omega@test.local', full_name: 'Omega' },
                },
              ],
            },
          ]);
        }

        if (url.includes('/messages')) {
          return makeJsonResponse([]);
        }

        return makeJsonResponse([]);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('shows unread badge for non-active chats', async () => {
    const view = render(
      <MemoryRouter>
        <ChatDashboard />
      </MemoryRouter>
    );

    await screen.findByText('Omega');
    expect(await screen.findByText('3')).toBeInTheDocument();
    view.unmount();
  });
});
