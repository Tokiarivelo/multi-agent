import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeysPage } from '../components/ApiKeysPage';
import { ApiKey } from '@/types';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'apiKeys.title': 'API Keys',
        'apiKeys.subtitle': 'Manage authentication keys for your model providers.',
        'apiKeys.addKey': 'Add API Key',
        'apiKeys.stats.total': 'Total Keys',
        'apiKeys.stats.active': 'Active & Valid',
        'apiKeys.stats.providers': 'Providers',
        'apiKeys.empty.title': 'No API keys configured',
        'apiKeys.empty.description': 'Add your first API key to start using LLM providers.',
        'apiKeys.empty.addFirst': 'Add your first key',
        'apiKeys.error': 'Failed to load API keys.',
        'apiKeys.key': 'key',
        'apiKeys.keys': 'keys',
        'apiKeys.card.unnamed': 'Unnamed Key',
        'apiKeys.card.valid': 'Valid',
        'apiKeys.card.invalid': 'Invalid',
        'apiKeys.card.active': 'Active',
        'apiKeys.card.inactive': 'Inactive',
        'apiKeys.card.created': 'Created',
        'apiKeys.card.lastUsed': 'Last used',
        'apiKeys.card.activate': 'Activate',
        'apiKeys.card.deactivate': 'Deactivate',
        'apiKeys.card.delete': 'Delete',
        'apiKeys.card.confirmDelete': 'Are you sure?',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock useSession from next-auth
const mockUser = { id: 'user-123', name: 'Test User', email: 'test@test.com' };
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: mockUser, accessToken: 'mock-token' },
    status: 'authenticated',
  }),
}));

// Mock LoadingSpinner
jest.mock('@/components/shared/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock hooks
const mockDeleteMutate = jest.fn();
const mockUpdateMutate = jest.fn();

let mockUseApiKeysReturn: {
  data: ApiKey[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

jest.mock('../hooks/useApiKeys', () => ({
  useApiKeys: () => mockUseApiKeysReturn,
  useDeleteApiKey: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useUpdateApiKey: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useCreateApiKey: () => ({ mutate: jest.fn(), isPending: false }),
}));

// Mock CreateApiKeyModal
jest.mock('../components/CreateApiKeyModal', () => ({
  CreateApiKeyModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

describe('ApiKeysPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApiKeysReturn = { data: undefined, isLoading: false, error: null };
  });

  it('should render the page header and add button', () => {
    mockUseApiKeysReturn = { data: [], isLoading: false, error: null };

    render(<ApiKeysPage />);

    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Add API Key')).toBeInTheDocument();
  });

  it('should show loading spinner when loading', () => {
    mockUseApiKeysReturn = { data: undefined, isLoading: true, error: null };

    render(<ApiKeysPage />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseApiKeysReturn = {
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    };

    render(<ApiKeysPage />);

    expect(screen.getByText('Failed to load API keys.')).toBeInTheDocument();
  });

  it('should show empty state when no keys exist', () => {
    mockUseApiKeysReturn = { data: [], isLoading: false, error: null };

    render(<ApiKeysPage />);

    expect(screen.getByText('No API keys configured')).toBeInTheDocument();
    expect(screen.getByText('Add your first key')).toBeInTheDocument();
  });

  it('should render API key cards grouped by provider', () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'Production Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 'key-2',
        userId: 'user-123',
        provider: 'ANTHROPIC',
        keyName: 'Anthropic Dev',
        apiKeyHash: 'hash2',
        isActive: true,
        isValid: true,
        createdAt: '2025-02-01T00:00:00Z',
        updatedAt: '2025-02-01T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    render(<ApiKeysPage />);

    // Verify keys are displayed
    expect(screen.getByText('Production Key')).toBeInTheDocument();
    expect(screen.getByText('Anthropic Dev')).toBeInTheDocument();

    // Verify provider grouping headers — text appears in both the header and card
    expect(screen.getAllByText('OPENAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ANTHROPIC').length).toBeGreaterThanOrEqual(1);
  });

  it('should display correct stats', () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'Active Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 'key-2',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'Inactive Key',
        apiKeyHash: 'hash2',
        isActive: false,
        isValid: true,
        createdAt: '2025-02-01T00:00:00Z',
        updatedAt: '2025-02-01T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    render(<ApiKeysPage />);

    // Total keys = 2
    expect(screen.getByText('2')).toBeInTheDocument();
    // Verify stat labels are present
    expect(screen.getByText('Total Keys')).toBeInTheDocument();
    expect(screen.getByText('Active & Valid')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    // Active & Valid stat should show 1 — we verify by checking there's at least one '1' in the stats area
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it('should open create modal when Add button is clicked', async () => {
    mockUseApiKeysReturn = { data: [], isLoading: false, error: null };

    render(<ApiKeysPage />);

    const addBtn = screen.getByText('Add API Key');
    await userEvent.click(addBtn);

    expect(screen.getByTestId('create-modal')).toBeInTheDocument();
  });

  it('should show valid/invalid badges correctly', () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'Valid Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 'key-2',
        userId: 'user-123',
        provider: 'ANTHROPIC',
        keyName: 'Invalid Key',
        apiKeyHash: 'hash2',
        isActive: true,
        isValid: false,
        createdAt: '2025-02-01T00:00:00Z',
        updatedAt: '2025-02-01T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    render(<ApiKeysPage />);

    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('should call delete mutation when delete is confirmed', async () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'My Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    // Mock window.confirm
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ApiKeysPage />);

    const deleteBtn = screen.getByText('Delete');
    await userEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
    expect(mockDeleteMutate).toHaveBeenCalledWith('key-1');

    confirmSpy.mockRestore();
  });

  it('should call update mutation when toggle active is clicked', async () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'My Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    render(<ApiKeysPage />);

    const deactivateBtn = screen.getByText('Deactivate');
    await userEvent.click(deactivateBtn);

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: 'key-1',
      input: { isActive: false },
    });
  });

  it('should not delete when confirm is cancelled', async () => {
    const mockKeys: ApiKey[] = [
      {
        id: 'key-1',
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'My Key',
        apiKeyHash: 'hash1',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
      },
    ];
    mockUseApiKeysReturn = { data: mockKeys, isLoading: false, error: null };

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ApiKeysPage />);

    const deleteBtn = screen.getByText('Delete');
    await userEvent.click(deleteBtn);

    expect(mockDeleteMutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
