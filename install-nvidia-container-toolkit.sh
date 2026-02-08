#!/bin/bash

# NVIDIA Container Toolkit 安装脚本（适用于 Ubuntu 20.04/22.04）

set -e

echo "开始安装 NVIDIA Container Toolkit..."

# 检查是否为 Ubuntu
if [ ! -f /etc/os-release ]; then
    echo "错误：无法检测到操作系统信息"
    exit 1
fi

# 获取发行版信息
. /etc/os-release
echo "检测到操作系统：$PRETTY_NAME"

# 安装必要的依赖
echo "安装必要的依赖..."
sudo apt-get update
sudo apt-get install -y curl gnupg lsb-release

# 配置 NVIDIA 仓库
echo "配置 NVIDIA 仓库..."

# 方法1：使用 NVIDIA 官方仓库（推荐）
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 更新软件包列表
echo "更新软件包列表..."
sudo apt-get update

# 安装 NVIDIA Container Toolkit
echo "安装 NVIDIA Container Toolkit..."
sudo apt-get install -y nvidia-container-toolkit

# 配置 Docker 使用 NVIDIA runtime
echo "配置 Docker runtime..."
sudo nvidia-ctk runtime configure --runtime=docker

# 重启 Docker
echo "重启 Docker 服务..."
sudo systemctl restart docker

# 验证安装
echo "验证安装..."
if command -v nvidia-ctk &> /dev/null; then
    echo "✓ NVIDIA Container Toolkit 安装成功！"
    nvidia-ctk --version
else
    echo "✗ 安装失败"
    exit 1
fi

# 测试 GPU 访问
echo "测试 GPU 访问..."
if docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi &> /dev/null; then
    echo "✓ GPU 访问测试成功！"
else
    echo "⚠ GPU 访问测试失败，请检查 NVIDIA 驱动是否正确安装"
fi

echo ""
echo "安装完成！"
echo "你可以使用以下命令测试 GPU 容器："
echo "  docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi"
