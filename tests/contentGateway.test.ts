import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

import { writeScannedContent } from '../src/lib/contentGateway';

describe('content gateway client contract', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.rpc.mockReset();
  });

  it('scans before calling the operation-specific RPC with the server payload and token', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        decision: 'allow',
        writeToken: 'single-use-token',
        writePayload: { entry_id: 'entry-1', proposed_data: { gloss: 'دارجة' } },
        requiresHumanReview: false,
        engineVersion: 'gateway-test',
        policyVersion: 'policy-test',
        expiresInSeconds: 90,
      },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: { id: 'submission-1' }, error: null });

    const result = await writeScannedContent('review_submissions.create', {
      entry_id: 'entry-1',
      proposed_data: { gloss: 'دارجة' },
    });

    expect(mocks.invoke).toHaveBeenCalledWith('content-safety-gateway', {
      body: {
        operation: 'review_submissions.create',
        payload: { entry_id: 'entry-1', proposed_data: { gloss: 'دارجة' } },
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith('submit_review_submission', {
      p_payload: { entry_id: 'entry-1', proposed_data: { gloss: 'دارجة' } },
      p_scan_token: 'single-use-token',
    });
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(result.data).toEqual({ id: 'submission-1' });
    expect(result.error).toBeNull();
  });

  it('fails closed when the scan request fails and never calls PostgREST RPC', async () => {
    const scanError = new Error('scanner unavailable');
    mocks.invoke.mockResolvedValue({ data: null, error: scanError });

    const result = await writeScannedContent('member_messages.create', { title: 'hello', body: 'world' });

    expect(result.data).toBeNull();
    expect(result.error).toBe(scanError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not write when the scan decision requires review or blocks the payload', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        decision: 'review',
        requiresHumanReview: true,
        engineVersion: 'gateway-test',
        policyVersion: 'policy-test',
      },
      error: null,
    });

    const result = await writeScannedContent('review_submissions.create', { entry_id: 'entry-2' });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.scan?.decision).toBe('review');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not retry with a direct write when the guarded RPC fails', async () => {
    const rpcError = new Error('guarded write rejected');
    mocks.invoke.mockResolvedValue({
      data: {
        decision: 'allow',
        writeToken: 'single-use-token',
        writePayload: { id: 'message-1', title: 'hello', body: 'world' },
        requiresHumanReview: false,
        engineVersion: 'gateway-test',
        policyVersion: 'policy-test',
      },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: null, error: rpcError });

    const result = await writeScannedContent('member_messages.create', { title: 'hello', body: 'world' });

    expect(result.error).toBe(rpcError);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
