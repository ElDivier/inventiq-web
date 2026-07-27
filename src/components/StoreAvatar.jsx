function getAvatarLetter(user) {
  const source = String(user?.store || user?.name || user?.email || 'INVENTIQ').trim();
  return source.charAt(0).toUpperCase() || 'I';
}

export default function StoreAvatar({ currentUser, size = 'md' }) {
  const sizes = {
    sm: 'h-10 w-10 text-base rounded-2xl',
    md: 'h-12 w-12 text-lg rounded-full',
    lg: 'h-16 w-16 text-2xl rounded-3xl',
  };

  const className = sizes[size] || sizes.md;

  if (currentUser?.logoUrl) {
    return (
      <img
        src={currentUser.logoUrl}
        alt="Logo de tienda"
        className={`${className} object-cover shadow-sm`}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center bg-purple-400 font-extrabold text-white shadow-sm ${className}`}>
      {getAvatarLetter(currentUser)}
    </div>
  );
}