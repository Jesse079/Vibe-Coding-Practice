Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () => {
      throw new DOMException("Permission denied for test", "NotAllowedError");
    },
  },
});

