import React from 'react';
import { Slot } from 'expo-router';

export default function TestLayout() {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Test App</h1>
      <p>If you can see this, routing is working</p>
      <Slot />
    </div>
  );
}