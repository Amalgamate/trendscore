import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AIAssistant from './AIAssistant';
import AskAIButton, { ASK_AI_EVENT } from './AskAIButton';

vi.mock('../../services/api/ai.api', () => ({
  aiAPI: {
    getHistory: vi.fn().mockResolvedValue({ data: [] }),
    chat: vi.fn(),
    archiveHistory: vi.fn(),
  },
}));

describe('AskAIButton', () => {
  it('opens the shared assistant with visible card context', async () => {
    render(
      <>
        <article data-ai-card="true">
          <h2>Attendance Overview</h2>
          <p>Attendance is 91 percent</p>
          <AskAIButton title="Attendance Overview" description="Weekly attendance" />
        </article>
        <AIAssistant currentPage="attendance" user={{ id: 'user-1' }} />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about Attendance Overview' }));

    expect(screen.getByRole('dialog', { name: 'TrendSCORE AI assistant' })).toBeInTheDocument();
    expect(screen.getByText(/Asking about:/)).toHaveTextContent('Attendance Overview');
    expect(screen.getByDisplayValue('What should I know about Attendance Overview?')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading history…')).not.toBeInTheDocument());
  });

  it('dispatches sanitized context without triggering the card action', () => {
    const cardAction = vi.fn();
    const listener = vi.fn();
    window.addEventListener(ASK_AI_EVENT, listener);

    render(
      <div data-ai-card="true" onClick={cardAction}>
        <span>Fee balance KES 12,000</span>
        <AskAIButton title="Fee Balance" context={{ overdue: true }} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about Fee Balance' }));

    expect(cardAction).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      title: 'Fee Balance',
      context: '{"overdue":true}',
      visibleText: 'Fee balance KES 12,000',
    });

    window.removeEventListener(ASK_AI_EVENT, listener);
  });
});
