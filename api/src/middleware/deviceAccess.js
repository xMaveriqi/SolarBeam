function usuarioPodeAcessarDispositivo(usuario, donoId) {
  if (!usuario) return false;
  return usuario.role === 'admin' || Number(usuario.id) === Number(donoId);
}

module.exports = { usuarioPodeAcessarDispositivo };
