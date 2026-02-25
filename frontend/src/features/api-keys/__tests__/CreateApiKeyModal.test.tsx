import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateApiKeyModal } from '../components/CreateApiKeyModal';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'apiKeys.create.title': 'Add API Key',
        'apiKeys.create.subtitle': 'Securely store an API key for a model provider.',
        'apiKeys.create.securityNote': 'Your API key will be encrypted.',
        'apiKeys.create.provider': 'Provider',
        'apiKeys.create.keyName': 'Key Name',
        'apiKeys.create.keyNamePlaceholder': 'e.g. My Personal OpenAI Key',
        'apiKeys.create.apiKeyValue': 'API Key Value',
        'apiKeys.create.cancel': 'Cancel',
        'apiKeys.create.save': 'Save API Key',
        'apiKeys.create.saving': 'Saving...',
      };
      return translations[key] || key;
    },
  }),
}));

const mockMutate = jest.fn();
jest.mock('../hooks/useApiKeys', () => ({
  useCreateApiKey: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe('CreateApiKeyModal', () => {
  const defaultProps = {
    userId: 'user-123',
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal with title and form fields', () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    expect(screen.getByText('Add API Key')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Key Name')).toBeInTheDocument();
    expect(screen.getByText('API Key Value')).toBeInTheDocument();
  });

  it('should render all provider buttons', () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Google AI')).toBeInTheDocument();
    expect(screen.getByText('Azure OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Ollama')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('should call onClose when Cancel is clicked', async () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    const cancelBtn = screen.getByText('Cancel');
    await userEvent.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when X button is clicked', async () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    // The X button is the first button with an SVG inside the header area
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons[0]; // first button in the modal is the X
    await userEvent.click(xButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should submit the form with correct data', async () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    const keyNameInput = screen.getByPlaceholderText('e.g. My Personal OpenAI Key');
    await userEvent.type(keyNameInput, 'Test OpenAI Key');

    const apiKeyInput = screen.getByPlaceholderText('sk-proj-...');
    await userEvent.type(apiKeyInput, 'sk-proj-abc123');

    const submitBtn = screen.getByText('Save API Key');
    await userEvent.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      {
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'Test OpenAI Key',
        apiKey: 'sk-proj-abc123',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('should toggle password visibility', async () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    const apiKeyInput = screen.getByPlaceholderText('sk-proj-...');
    expect(apiKeyInput).toHaveAttribute('type', 'password');

    // The eye toggle button is the only button inside the input's wrapper div.
    // We find all buttons that have only an SVG child (no text),
    // excluding the X close button at the top.
    const allButtons = screen.getAllByRole('button');
    const knownTexts = [
      'OpenAI',
      'Anthropic',
      'Google AI',
      'Azure OpenAI',
      'Ollama',
      'Custom',
      'Cancel',
      'Save API Key',
    ];
    const svgOnlyButtons = allButtons.filter(
      (btn) =>
        !knownTexts.some((text) => btn.textContent?.includes(text)) && btn.querySelector('svg'),
    );
    // svgOnlyButtons[0] = X close button, svgOnlyButtons[1] = eye toggle button
    const eyeButton = svgOnlyButtons[1];

    expect(eyeButton).toBeTruthy();
    await userEvent.click(eyeButton);
    expect(apiKeyInput).toHaveAttribute('type', 'text');
  });

  it('should change provider when a provider button is clicked', async () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    const anthropicBtn = screen.getByText('Anthropic');
    await userEvent.click(anthropicBtn);

    // After selecting Anthropic, the API key placeholder should change
    const apiKeyInput = screen.getByPlaceholderText('sk-ant-...');
    expect(apiKeyInput).toBeInTheDocument();
  });

  it('should disable submit button when fields are empty', () => {
    render(<CreateApiKeyModal {...defaultProps} />);

    const submitBtn = screen.getByText('Save API Key');
    expect(submitBtn).toBeDisabled();
  });
});
