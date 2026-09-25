export function saveErrorMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 409) return 'Có người khác vừa lưu. Nội dung bạn đang gõ vẫn được giữ.';
  if (status === 401) return 'Phiên đăng nhập hết hạn. Đăng nhập lại để lưu; bản nháp vẫn được giữ.';
  if (status === 403) return 'Bạn không có quyền thực hiện thay đổi này.';
  if (status === 422) return 'Một hoặc nhiều trường không hợp lệ.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
