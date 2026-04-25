import React from 'react';
import { Link } from 'react-router-dom';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import ThemeToggle from './ThemeToggle';
import { Brain } from 'lucide-react';

const Navbar = () => {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(10px)',
      background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)'
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.25rem' }}>
        <Brain size={24} color="var(--primary)" />
        <span>AdaptIQ</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ThemeToggle />
        
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>

        <Show when="signed-in">
          <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 36, height: 36 } } }} />
        </Show>
      </div>
    </nav>
  );
};

export default Navbar;
