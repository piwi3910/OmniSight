import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock useNavigate hook
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

// Mock the auth context
const mockAuthContextValue = {
  isAuthenticated: true,
  user: { id: 'test-user', name: 'Test User', role: 'ADMIN' },
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider value={mockAuthContextValue}>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Layout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the layout with sidebar and header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    // Check that the header contains logo
    expect(screen.getByAltText(/OmniSight logo/i)).toBeInTheDocument();
    
    // Check sidebar navigation items
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/cameras/i)).toBeInTheDocument();
    expect(screen.getByText(/recordings/i)).toBeInTheDocument();
    expect(screen.getByText(/events/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    
    // Check that the content is rendered
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
  
  it('toggles the sidebar when toggle button is clicked', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const sidebar = screen.getByTestId('sidebar');
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    
    // Initially sidebar should be open (default state)
    expect(sidebar).toHaveClass('sidebar-open');
    
    // Click the toggle button
    userEvent.click(toggleButton);
    
    // Sidebar should be closed
    expect(sidebar).toHaveClass('sidebar-closed');
    
    // Click the toggle button again
    userEvent.click(toggleButton);
    
    // Sidebar should be open again
    expect(sidebar).toHaveClass('sidebar-open');
  });
  
  it('calls logout function when logout button is clicked', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logoutButton = screen.getByText(/logout/i);
    userEvent.click(logoutButton);
    
    expect(mockAuthContextValue.logout).toHaveBeenCalledTimes(1);
  });
  
  it('renders the user name in the header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
  
  it('shows mobile menu on small screens when menu button is clicked', () => {
    // Mock window.innerWidth to simulate mobile device
    global.innerWidth = 500;
    global.dispatchEvent(new Event('resize'));
    
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const mobileMenuButton = screen.getByLabelText(/menu/i);
    const mobileMenu = screen.getByTestId('mobile-menu');
    
    // Initially mobile menu should be hidden
    expect(mobileMenu).toHaveClass('mobile-menu-hidden');
    
    // Click the mobile menu button
    userEvent.click(mobileMenuButton);
    
    // Mobile menu should be visible
    expect(mobileMenu).toHaveClass('mobile-menu-visible');
  });
  
  it('navigates when sidebar navigation item is clicked', () => {
    const navigateMock = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigateMock);
    
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const dashboardLink = screen.getByText(/dashboard/i);
    userEvent.click(dashboardLink);
    
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });
});