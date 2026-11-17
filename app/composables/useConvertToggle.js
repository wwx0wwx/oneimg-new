/**
 * 压缩/转换格式开关（webp/png 互斥）——此前 MediaPolicyPanel 与 PrivateUploadPanel 各一份拷贝
 */
export function useConvertToggle(formRef) {
  function toggleConvertFormat(format) {
    if (format === 'webp') {
      formRef.convertToWebp = !formRef.convertToWebp
      if (formRef.convertToWebp) formRef.convertToPng = false
    } else if (format === 'png') {
      formRef.convertToPng = !formRef.convertToPng
      if (formRef.convertToPng) formRef.convertToWebp = false
    }
  }
  return { toggleConvertFormat }
}
