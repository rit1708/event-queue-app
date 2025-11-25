import { useState } from 'react';
import { EventsList, type Event } from 'queue-sdk';

interface HomePageProps {
  onEventSelect: (event: Event) => void;
}

export const HomePage = ({ onEventSelect }: HomePageProps) => {
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 10));

  return (
    <EventsList
      userId={userId}
      onEventSelect={onEventSelect}
      autoJoin={true}
    />
  );
};

