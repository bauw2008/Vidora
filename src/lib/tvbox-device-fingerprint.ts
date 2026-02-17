/**
 * 设备指纹工具类
 * 用于生成和验证设备唯一标识
 */

interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  hardwareConcurrency: number;
  deviceMemory: number;
}

export interface DeviceFingerprint {
  deviceId: string;
  deviceInfo: string;
  bindTime: number;
  ipAddress?: string;
  username?: string;
}

/**
 * 获取设备信息
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    userAgent: navigator.userAgent || '',
    language: navigator.language || '',
    platform: navigator.platform || '',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory || 0,
  };
}

/**
 * 生成设备指纹ID
 * 基于设备信息生成唯一的设备标识
 */
export function generateDeviceId(deviceInfo: DeviceInfo): string {
  // 使用稳定的设备特征生成指纹
  const fingerprintData = [
    deviceInfo.userAgent,
    deviceInfo.platform,
    deviceInfo.screenResolution,
    deviceInfo.hardwareConcurrency.toString(),
    deviceInfo.deviceMemory.toString(),
  ].join('|');

  // 简单的哈希函数
  let hash = 0;
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }

  return Math.abs(hash).toString(36);
}

/**
 * 生成设备信息字符串（用于显示）
 */
export function generateDeviceInfoString(deviceInfo: DeviceInfo): string {
  const browser = getBrowserInfo(deviceInfo.userAgent);
  const os = getOSInfo(deviceInfo.userAgent);

  return `${browser} | ${os} | ${deviceInfo.screenResolution} | ${deviceInfo.language}`;
}

/**
 * 从User-Agent中提取浏览器信息
 */
function getBrowserInfo(userAgent: string): string {
  if (userAgent.includes('Chrome')) {
    return 'Chrome';
  }
  if (userAgent.includes('Firefox')) {
    return 'Firefox';
  }
  if (userAgent.includes('Safari')) {
    return 'Safari';
  }
  if (userAgent.includes('Edge')) {
    return 'Edge';
  }
  if (userAgent.includes('Opera')) {
    return 'Opera';
  }
  return 'Unknown Browser';
}

/**
 * 从User-Agent中提取操作系统信息
 */
function getOSInfo(userAgent: string): string {
  if (userAgent.includes('Windows')) {
    return 'Windows';
  }
  if (userAgent.includes('Mac')) {
    return 'macOS';
  }
  if (userAgent.includes('Linux')) {
    return 'Linux';
  }
  if (userAgent.includes('Android')) {
    return 'Android';
  }
  if (userAgent.includes('iOS')) {
    return 'iOS';
  }
  return 'Unknown OS';
}

/**
 * 验证设备指纹是否匹配
 */
export function verifyDeviceFingerprint(
  storedFingerprint: DeviceFingerprint,
  currentDeviceInfo: DeviceInfo,
  currentIP?: string,
): boolean {
  // 生成当前设备的指纹ID
  const currentDeviceId = generateDeviceId(currentDeviceInfo);

  // 比较设备ID
  if (currentDeviceId !== storedFingerprint.deviceId) {
    return false;
  }

  // 如果提供了IP地址，验证IP是否匹配
  if (
    currentIP &&
    storedFingerprint.ipAddress &&
    storedFingerprint.ipAddress !== currentIP
  ) {
    return false;
  }

  return true;
}

/**
 * 获取当前设备的指纹
 */
export function getCurrentDeviceFingerprint(
  ipAddress?: string,
  username?: string,
): DeviceFingerprint {
  const deviceInfo = getDeviceInfo();
  const deviceId = generateDeviceId(deviceInfo);
  const deviceInfoString = generateDeviceInfoString(deviceInfo);

  return {
    deviceId,
    deviceInfo: deviceInfoString,
    bindTime: Date.now(),
    ipAddress,
    username,
  };
}

/**
 * 检查是否超过设备绑定限制
 */
export function isDeviceLimitExceeded(
  currentDevices: DeviceFingerprint[],
  maxDevices: number,
): boolean {
  return currentDevices.length >= maxDevices;
}

/**
 * 添加新设备绑定
 */
export function addDeviceBinding(
  currentDevices: DeviceFingerprint[],
  newDevice: DeviceFingerprint,
  maxDevices: number,
): DeviceFingerprint[] {
  // 检查设备是否已存在
  const existingIndex = currentDevices.findIndex(
    (device) => device.deviceId === newDevice.deviceId,
  );

  let updatedDevices = [...currentDevices];

  if (existingIndex !== -1) {
    // 更新现有设备信息
    updatedDevices[existingIndex] = {
      ...newDevice,
      bindTime: Date.now(),
    };
  } else {
    // 添加新设备
    updatedDevices.push(newDevice);

    // 如果超过最大设备数，移除最早的设备
    if (updatedDevices.length > maxDevices) {
      updatedDevices.sort((a, b) => a.bindTime - b.bindTime);
      updatedDevices = updatedDevices.slice(-maxDevices);
    }
  }

  return updatedDevices;
}

/**
 * 移除设备绑定
 */
export function removeDeviceBinding(
  currentDevices: DeviceFingerprint[],
  deviceId: string,
): DeviceFingerprint[] {
  return currentDevices.filter((device) => device.deviceId !== deviceId);
}

/**
 * 检查设备是否已绑定
 */
export function isDeviceBound(
  currentDevices: DeviceFingerprint[],
  deviceId: string,
): boolean {
  return currentDevices.some((device) => device.deviceId === deviceId);
}
