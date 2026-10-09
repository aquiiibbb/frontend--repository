import React from 'react';

// Official Booking.com Logo SVG (solid navy box with B. and cyan dot)
export function BookingComLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(28 * scale)} height={size} viewBox="0 0 28 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <rect width="28" height="16" rx="3.5" fill="#003580"/>
      <text x="3" y="12" fill="#FFFFFF" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="11" letterSpacing="-0.5px">B.</text>
      <circle cx="22.5" cy="11" r="2" fill="#00B1E7"/>
    </svg>
  );
}

// Official Airbnb Bélo Logo SVG (coral red logo shape)
export function AirbnbLogo({ size = 15 }) {
  return (
    <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <path fill="#FF5A5F" d="M16 1c-2.008 0-3.463.963-4.751 3.269l-.533 1.025c-1.954 3.83-6.114 12.54-7.1 14.836l-.145.353c-.667 1.591-.91 2.472-.968 3.396-.076 1.207.252 2.449.92 3.489 1.137 1.77 3.129 2.632 5.539 2.632 2.379 0 4.752-1.077 7.039-3.21 2.287 2.133 4.66 3.21 7.039 3.21 2.41 0 4.402-.862 5.539-2.632.668-1.04.996-2.282.92-3.489-.058-.924-.301-1.805-.97-3.407l-.143-.342c-.987-2.296-5.147-11.006-7.101-14.836l-.533-1.025C19.463 1.963 18.008 1 16 1zm0 3.2c1.07 0 1.96.53 2.927 2.259l.526 1.011c1.921 3.766 6.01 12.33 6.942 14.502.583 1.392.778 2.083.82 2.754.045.717-.149 1.454-.548 2.073-.655 1.019-1.821 1.501-3.327 1.501-1.678 0-3.473-.895-5.34-2.662l-.76-.718-.76.718c-1.867 1.767-3.662 2.662-5.34 2.662-1.506 0-2.672-.482-3.327-1.501-.399-.619-.593-1.356-.548-2.073.042-.671.237-1.362.82-2.754.932-2.172 5.021-10.736 6.942-14.502l.526-1.011C14.04 4.73 14.93 4.2 16 4.2zm0 6.6a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm0 2.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z"/>
    </svg>
  );
}

// Official Expedia Logo SVG (solid navy box with yellow plane)
export function ExpediaLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(24 * scale)} height={size} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <rect width="24" height="16" rx="3.5" fill="#00256C"/>
      <path fill="#FFC72C" d="M19 10L13.5 6.5V2c0-.55-.45-1-1-1s-1 .45-1 1v4.5L6 10v1.5l5.5-2V14l-1.5 1v1l2.5-.8 2.5 .8v-1l-1.5-1V9.5l5.5 2V10z"/>
    </svg>
  );
}

// Official Agoda 5-Dots Logo SVG
export function AgodaLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(32 * scale)} height={size} viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <circle cx="4" cy="10" r="3" fill="#E53935"/>
      <circle cx="10" cy="6" r="3" fill="#FBC02D"/>
      <circle cx="16" cy="10" r="3" fill="#43A047"/>
      <circle cx="22" cy="6" r="3" fill="#00ACC1"/>
      <circle cx="28" cy="10" r="3" fill="#8E24AA"/>
    </svg>
  );
}

// Official MakeMyTrip Logo SVG (solid red box with mmt text)
export function MakeMyTripLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(28 * scale)} height={size} viewBox="0 0 28 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <rect width="28" height="16" rx="3.5" fill="#E41D36"/>
      <text x="2.5" y="12" fill="#FFFFFF" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="10.5" letterSpacing="-0.6px">mmt</text>
    </svg>
  );
}

// Official TripAdvisor Owl Logo SVG
export function TripAdvisorLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(24 * scale)} height={size} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <rect width="24" height="16" rx="3.5" fill="#00AF87"/>
      <circle cx="8" cy="8" r="3.5" fill="#FFFFFF"/>
      <circle cx="16" cy="8" r="3.5" fill="#FFFFFF"/>
      <circle cx="8" cy="8" r="1.8" fill="#000000"/>
      <circle cx="16" cy="8" r="1.8" fill="#000000"/>
      <polygon points="10,9.5 14,9.5 12,12.5" fill="#FFC107"/>
    </svg>
  );
}

// Direct / Walk-In Hotel Building SVG Logo
export function DirectHotelLogo({ size = 15 }) {
  const scale = size / 15;
  return (
    <svg width={Math.round(20 * scale)} height={size} viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <rect width="20" height="16" rx="3.5" fill="#10B981"/>
      <path fill="#FFFFFF" d="M5 3h10v10H5V3zm2 2v1.5h1.5V5H7zm4 0v1.5h1.5V5H11zm-4 3v1.5h1.5V8H7zm4 0v1.5h1.5V8H11zm-4 3v2h4v-2H7z"/>
    </svg>
  );
}

export const getOtaChannelInfo = (sourceStr = '') => {
  const s = String(sourceStr || '').toLowerCase().trim();
  
  if (s.includes('booking.com') || s.includes('booking') || s.includes('bcom')) {
    return {
      key: 'booking.com',
      name: 'Booking.com',
      shortName: 'Booking.com',
      LogoComponent: BookingComLogo,
      category: 'OTA'
    };
  }
  
  if (s.includes('expedia') || s.includes('hotels.com') || s.includes('vrbo') || s.includes('orbitz') || s.includes('travelocity')) {
    return {
      key: 'expedia',
      name: s.includes('hotels.com') ? 'Hotels.com' : 'Expedia',
      shortName: 'Expedia',
      LogoComponent: ExpediaLogo,
      category: 'OTA'
    };
  }
  
  if (s.includes('airbnb')) {
    return {
      key: 'airbnb',
      name: 'Airbnb',
      shortName: 'Airbnb',
      LogoComponent: AirbnbLogo,
      category: 'OTA'
    };
  }
  
  if (s.includes('agoda')) {
    return {
      key: 'agoda',
      name: 'Agoda',
      shortName: 'Agoda',
      LogoComponent: AgodaLogo,
      category: 'OTA'
    };
  }
  
  if (s.includes('makemytrip') || s.includes('mmt') || s.includes('goibibo')) {
    return {
      key: 'makemytrip',
      name: 'MakeMyTrip',
      shortName: 'MakeMyTrip',
      LogoComponent: MakeMyTripLogo,
      category: 'OTA'
    };
  }
  
  if (s.includes('tripadvisor')) {
    return {
      key: 'tripadvisor',
      name: 'TripAdvisor',
      shortName: 'TripAdvisor',
      LogoComponent: TripAdvisorLogo,
      category: 'OTA'
    };
  }

  if (s.includes('walk') || s.includes('front desk') || s.includes('walk-in')) {
    return {
      key: 'walkin',
      name: 'Walk-In',
      shortName: 'Walk-In',
      LogoComponent: DirectHotelLogo,
      category: 'Direct'
    };
  }

  // Default: Direct / Web Booking
  return {
    key: 'direct',
    name: sourceStr || 'Direct Web',
    shortName: sourceStr ? sourceStr.split(' ')[0] : 'Direct',
    LogoComponent: DirectHotelLogo,
    category: 'Direct'
  };
};

export default function OtaBadge({ 
  source = '', 
  channel = '', 
  size = 'xs', // 'xs' | 'sm' | 'md' | 'lg'
  showText = false,
  otaBookingId = '',
  className = ''
}) {
  const info = getOtaChannelInfo(source || channel);
  const LogoComponent = info.LogoComponent;

  const iconPxSize = size === 'xs' ? 14 : size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  // Pure SVG logo render - NO BORDER, NO PILL CONTAINER
  if (!showText) {
    return (
      <span 
        className={`ota-logo-only ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
          margin: '0 2px',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          outline: 'none',
          cursor: 'default'
        }}
        title={`Source: ${info.name}${otaBookingId ? ` (Ref: ${otaBookingId})` : ''}`}
      >
        <LogoComponent size={iconPxSize} />
      </span>
    );
  }

  // Logo with Text - NO BORDER, NO PILL CONTAINER
  return (
    <div 
      className={`ota-badge-clean ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 2px',
        fontSize: size === 'lg' ? '13px' : '12px',
        fontWeight: '700',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        lineHeight: 1
      }}
      title={`Booking Source: ${info.name}${otaBookingId ? ` | OTA ID: ${otaBookingId}` : ''}`}
    >
      <LogoComponent size={iconPxSize} />
      <span style={{ fontWeight: '800' }}>{info.name}</span>
      {otaBookingId && (
        <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: '600' }}>
          #{otaBookingId}
        </span>
      )}
    </div>
  );
}
