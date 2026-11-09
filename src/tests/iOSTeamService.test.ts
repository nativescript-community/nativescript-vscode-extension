import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iOSTeamService } from '../services/iOSTeamService';
import { testing, window, workspace } from './mocks/vscode';

type Team = { id: string; name: string };

const TEAMS: Team[] = [
  { id: 'TEAM1', name: 'First Team' },
  { id: 'TEAM2', name: 'Second Team' },
];

describe('iOSTeamService.selectTeam', () => {
  let service: iOSTeamService;
  let getDevelopmentTeams: ReturnType<typeof vi.fn<() => Team[]>>;

  const configUpdates = () =>
    workspace.getConfiguration.mock.results.flatMap((result) => result.value.update.mock.calls as unknown[][]);

  beforeEach(() => {
    service = new iOSTeamService();
    getDevelopmentTeams = vi.fn(() => TEAMS);
    vi.spyOn(
      iOSTeamService.prototype as unknown as { getDevelopmentTeams: () => Team[] },
      'getDevelopmentTeams',
    ).mockImplementation(getDevelopmentTeams);
  });

  afterEach(() => {
    delete testing.configuration['nativescript.iosTeamId'];
  });

  it('uses the team id from the workspace settings without prompting', async () => {
    testing.configuration['nativescript.iosTeamId'] = 'CONFIGURED';

    await expect(service.selectTeam()).resolves.toEqual({ id: 'CONFIGURED', name: '' });
    expect(window.showQuickPick).not.toHaveBeenCalled();
    expect(getDevelopmentTeams).not.toHaveBeenCalled();
  });

  it('resolves undefined when the Quick Pick is dismissed', async () => {
    window.showQuickPick.mockResolvedValueOnce(undefined);

    await expect(service.selectTeam()).resolves.toBeUndefined();
    expect(window.showQuickPick).toHaveBeenCalledExactlyOnceWith(
      [
        { description: 'TEAM1', label: 'First Team' },
        { description: 'TEAM2', label: 'Second Team' },
      ],
      { placeHolder: 'Select your development team' },
    );
    expect(configUpdates()).toEqual([]);
  });

  it('returns the picked team and remembers it in the settings', async () => {
    window.showQuickPick.mockResolvedValueOnce({ description: 'TEAM2', label: 'Second Team' });

    await expect(service.selectTeam()).resolves.toEqual({ id: 'TEAM2', name: 'Second Team' });
    expect(configUpdates()).toEqual([['nativescript.iosTeamId', 'TEAM2']]);
  });

  it.each([[[]], [[TEAMS[0]]]])('resolves undefined without prompting for %j', async (teams) => {
    getDevelopmentTeams.mockReturnValue(teams);

    await expect(service.selectTeam()).resolves.toBeUndefined();
    expect(window.showQuickPick).not.toHaveBeenCalled();
  });
});
