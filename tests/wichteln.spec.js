const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Map CDN URLs to local node_modules files
const cdnRoutes = {
  'cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js':
    path.resolve(__dirname, '../node_modules/react/umd/react.production.min.js'),
  'cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js':
    path.resolve(__dirname, '../node_modules/react-dom/umd/react-dom.production.min.js'),
  'cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js':
    path.resolve(__dirname, '../node_modules/@babel/standalone/babel.min.js')
};

// Intercept CDN requests and serve local files; block Google Fonts to speed up tests
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();

    // Block Google Fonts — not needed for functional tests
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }

    // Serve CDN JS from local node_modules
    for (const [cdnPath, localPath] of Object.entries(cdnRoutes)) {
      if (url.includes(cdnPath)) {
        const body = fs.readFileSync(localPath);
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body
        });
      }
    }

    return route.continue();
  });

  // Clear localStorage for a clean slate
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

// ---------------------------------------------------------------------------
// 1. Create Event
// ---------------------------------------------------------------------------
test.describe('Event erstellen', () => {
  test('should show create-event form when no event exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Neues Event erstellen')).toBeVisible();
  });

  test('should create an event and show organizer view', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[placeholder*="Familie Wichteln"]', 'Weihnachten 2026');
    await page.fill('input[type="datetime-local"]', '2026-12-24T18:00');
    await page.click('button:has-text("Event erstellen")');

    // Should now be on the organizer dashboard
    await expect(page.locator('text=Weihnachten 2026')).toBeVisible();
    await expect(page.locator('.card-title:has-text("Teilnehmer hinzufügen")')).toBeVisible();
    await expect(page.locator('text=Einladungslink')).toBeVisible();

    // Verify localStorage
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wichteln-event')));
    expect(stored.name).toBe('Weihnachten 2026');
    expect(stored.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// 2. Add Participants (organizer)
// ---------------------------------------------------------------------------
test.describe('Teilnehmer hinzufügen', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-test',
        name: 'Test Wichteln',
        drawDate: '2026-12-24T18:00',
        status: 'pending',
        participants: [],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });
    await page.goto('/');
  });

  test('should add participants and display them in the list', async ({ page }) => {
    const names = ['Anna', 'Bob', 'Clara'];
    const phones = ['+49 111', '+49 222', '+49 333'];

    for (let i = 0; i < names.length; i++) {
      await page.fill('input[placeholder="Max Mustermann"]', names[i]);
      await page.fill('input[placeholder="+49 123 456789"]', phones[i]);
      await page.click('button:has-text("Teilnehmer hinzufügen")');
    }

    // All three should appear
    for (const name of names) {
      await expect(page.locator(`.participant-name:has-text("${name}")`)).toBeVisible();
    }

    // Counter in heading
    await expect(page.locator('text=Teilnehmer (3)')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Join via link
// ---------------------------------------------------------------------------
test.describe('Beitritt über Link', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-join-test',
        name: 'Join Wichteln',
        drawDate: '2026-12-24T18:00',
        status: 'pending',
        participants: [],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });
  });

  test('should show join form when navigating with ?event= param', async ({ page }) => {
    await page.goto('/?event=ev-join-test');
    await expect(page.locator('text=Jetzt teilnehmen')).toBeVisible();
    await expect(page.locator('text=Join Wichteln')).toBeVisible();
  });

  test('should allow a participant to join', async ({ page }) => {
    await page.goto('/?event=ev-join-test');

    // Handle the alert that fires on successful join
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Erfolgreich angemeldet');
      await dialog.accept();
    });

    await page.fill('input[placeholder="Max Mustermann"]', 'Dieter');
    await page.fill('input[placeholder="+49 123 456789"]', '+49 444');
    await page.click('button:has-text("Anmelden")');

    // Verify participant was persisted
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wichteln-event')));
    expect(stored.participants).toHaveLength(1);
    expect(stored.participants[0].name).toBe('Dieter');
  });

  test('should show error for invalid event id', async ({ page }) => {
    await page.goto('/?event=ev-does-not-exist');
    await expect(page.locator('text=Event nicht gefunden')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Perform Draw
// ---------------------------------------------------------------------------
test.describe('Ziehung durchführen', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-draw-test',
        name: 'Draw Wichteln',
        drawDate: '2026-12-24T18:00',
        status: 'pending',
        participants: [
          { id: 'p-1', name: 'Anna', phone: '+49 1', token: 'tk-aaa', assignedTo: null, joinedAt: new Date().toISOString() },
          { id: 'p-2', name: 'Bob', phone: '+49 2', token: 'tk-bbb', assignedTo: null, joinedAt: new Date().toISOString() },
          { id: 'p-3', name: 'Clara', phone: '+49 3', token: 'tk-ccc', assignedTo: null, joinedAt: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });
    await page.goto('/');
  });

  test('should perform draw and assign all participants', async ({ page }) => {
    // Handle the success alert
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('button:has-text("Jetzt Ziehung durchführen")');

    // Status should now show completed
    await expect(page.locator('text=Ziehung abgeschlossen')).toBeVisible();

    // Verify assignments in localStorage
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wichteln-event')));
    expect(stored.status).toBe('completed');

    // Every participant should have an assignment
    for (const p of stored.participants) {
      expect(p.assignedTo).not.toBeNull();
      // No self-assignment
      expect(p.assignedTo).not.toBe(p.id);
    }

    // All assigned-to IDs should be unique (everyone gets exactly one gift)
    const assignedIds = stored.participants.map(p => p.assignedTo);
    expect(new Set(assignedIds).size).toBe(stored.participants.length);
  });
});

// ---------------------------------------------------------------------------
// 5. Participant view (token URL)
// ---------------------------------------------------------------------------
test.describe('Teilnehmer-Ansicht', () => {
  test('should show waiting view before draw', async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-pv',
        name: 'PV Wichteln',
        drawDate: '2026-12-24T18:00',
        status: 'pending',
        participants: [
          { id: 'p-1', name: 'Anna', phone: '+49 1', token: 'tk-view1', assignedTo: null, joinedAt: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });

    await page.goto('/?p=tk-view1');
    await expect(page.locator('text=Noch nicht soweit')).toBeVisible();
  });

  test('should reveal assigned person after draw', async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-pv2',
        name: 'PV Wichteln 2',
        drawDate: '2026-12-24T18:00',
        status: 'completed',
        drawnAt: new Date().toISOString(),
        participants: [
          { id: 'p-1', name: 'Anna', phone: '+49 1', token: 'tk-reveal1', assignedTo: 'p-2', joinedAt: new Date().toISOString() },
          { id: 'p-2', name: 'Bob', phone: '+49 2', token: 'tk-reveal2', assignedTo: 'p-1', joinedAt: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });

    await page.goto('/?p=tk-reveal1');
    await expect(page.locator('text=Du beschenkst')).toBeVisible();
    await expect(page.locator('.assigned-name')).toHaveText('Bob');
  });

  test('should show error for invalid token', async ({ page }) => {
    await page.goto('/?p=tk-invalid');
    await expect(page.locator('text=Event nicht gefunden')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Delete event data
// ---------------------------------------------------------------------------
test.describe('Daten löschen', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      const event = {
        id: 'ev-del',
        name: 'Delete Wichteln',
        drawDate: '2026-12-24T18:00',
        status: 'pending',
        participants: [
          { id: 'p-1', name: 'Anna', phone: '+49 1', token: 'tk-del1', assignedTo: null, joinedAt: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('wichteln-event', JSON.stringify(event));
    });
    await page.goto('/');
  });

  test('should delete all data when confirmed', async ({ page }) => {
    // Accept both confirmation dialogs
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('button:has-text("Alle Daten löschen")');

    // After navigation, localStorage should be empty
    await page.waitForURL(/^http:\/\/localhost:\d+\/$/);
    const stored = await page.evaluate(() => localStorage.getItem('wichteln-event'));
    expect(stored).toBeNull();
  });
});
