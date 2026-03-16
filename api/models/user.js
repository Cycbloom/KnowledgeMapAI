export function excludePassword(user) {
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
